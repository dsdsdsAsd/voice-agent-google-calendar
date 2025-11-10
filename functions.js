const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const https = require('https');

const credentials = require('./google_credentials.json');
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, REFRESH_TOKEN, CALENDAR_ID } = credentials;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

const DATA_FILE = path.join(__dirname, './data.json');

function readData() {
    try {
        console.log('[DEBUG] Reading data.json...');
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        console.log('[DEBUG] data.json read successfully.');
        return JSON.parse(data);
    } catch (error) {
        console.error('[DEBUG] Error reading data.json:', error);
        return {};
    }
}

function getRealCurrentDate() {
    return new Promise((resolve, reject) => {
        console.log('[DEBUG] Getting real current date from aisenseapi...');
        https.get('https://aisenseapi.com/services/v1/timestamp', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    console.log('[DEBUG] Got timestamp from aisenseapi:', parsedData.timestamp);
                    resolve(new Date(parsedData.timestamp * 1000));
                } catch (e) {
                    console.error('[DEBUG] Error parsing aisenseapi response:', e);
                    reject(e);
                }
            });
        }).on('error', (err) => {
            console.error('[DEBUG] Error calling aisenseapi:', err);
            reject(err);
        });
    });
}

function getAvailableServices() {
    console.log('[CALL] getAvailableServices');
    try {
        const data = readData();
        const serviceNames = data.services.map(s => s.name);
        return { success: true, services: serviceNames };
    } catch (error) {
        console.error('[DEBUG] Error in getAvailableServices:', error);
        return { success: false, message: 'Не удалось получить список услуг.' };
    }
}

async function findFirstAvailableSlots(service_type) {
    console.log(`[CALL] findFirstAvailableSlots: service_type='${service_type}'`);
    
    let today;
    let targetDate;
    try {
        today = await getRealCurrentDate();
        targetDate = new Date(today.getTime());
        console.log('[DEBUG] Current date is:', today);
    } catch (error) {
        console.error('[DEBUG] Error in getRealCurrentDate call:', error);
        return { success: false, message: "Не удалось получить точное время для начала поиска." };
    }

    const todayDateString = today.toISOString().split('T')[0];
    const data = readData();
    if (!data || !data.services) {
        console.error('[DEBUG] data.json is empty or does not contain services.');
        return { success: false, message: "Ошибка чтения файла с данными об услугах." };
    }

    const serviceCenterId = data.service_centers[0].id;
    const operatingHours = data.service_centers[0].operating_hours;
    const service = data.services.find(s => s.service_center_id === serviceCenterId && s.name.toLowerCase() === service_type.toLowerCase());

    if (!service) {
        console.error(`[DEBUG] Service '${service_type}' not found.`);
        return { success: false, message: `Услуга '${service_type}' не найдена.` };
    }
    console.log(`[DEBUG] Found service: ${service.name}`);

    const serviceDurationMinutes = service.estimated_duration_minutes;

    for (let i = 0; i < 30; i++) {
        const datePart = targetDate.toISOString().split('T')[0];
        console.log(`[DEBUG] Checking date: ${datePart}`);
        const dayOfWeek = targetDate.getDay();

        let hours;
        if (dayOfWeek === 0) { hours = operatingHours['Вс']; }
        else if (dayOfWeek === 6) { hours = operatingHours['Сб']; }
        else { hours = operatingHours['Пн-Пт']; }

        if (!hours || hours.toLowerCase() === 'закрыто') {
            console.log(`[DEBUG] Service center is closed on ${datePart}`);
            targetDate.setDate(targetDate.getDate() + 1);
            continue;
        }

        try {
            const dayStart = new Date(datePart + 'T00:00:00Z');
            const dayEnd = new Date(datePart + 'T23:59:59Z');

            console.log(`[DEBUG] Querying Google Calendar for free/busy from ${dayStart.toISOString()} to ${dayEnd.toISOString()}`);
            const response = await calendar.freebusy.query({
                requestBody: {
                    timeMin: dayStart.toISOString(),
                    timeMax: dayEnd.toISOString(),
                    items: [{ id: CALENDAR_ID }],
                },
            });
            console.log('[DEBUG] Google Calendar response received.');

            const busyTimes = response.data.calendars[CALENDAR_ID].busy;
            const availableSlots = [];
            
            const [startHourMSK, endHourMSK] = hours.split('-').map(h => parseInt(h.split(':')[0]));
            const moscowOffset = 3;
            const startHourUTC = startHourMSK - moscowOffset;
            const endHourUTC = endHourMSK - moscowOffset;

            const stepMinutes = 30;
            const [year, month, day] = datePart.split('-').map(Number);

            const endOfWorkingDay = new Date(Date.UTC(year, month - 1, day, endHourUTC, 0, 0));

            for (let hour = startHourUTC; hour < endHourUTC; hour++) {
                for (let minute = 0; minute < 60; minute += stepMinutes) {
                    const slotStart = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

                    if (datePart === todayDateString && slotStart.getTime() < today.getTime()) {
                        continue;
                    }

                    const slotEnd = new Date(slotStart.getTime() + serviceDurationMinutes * 60 * 1000);

                    if (slotEnd.getTime() > endOfWorkingDay.getTime()) {
                        continue;
                    }

                    const isOverlapping = busyTimes.some(busyBlock => {
                        const busyStart = new Date(busyBlock.start);
                        const busyEnd = new Date(busyBlock.end);
                        return slotStart.getTime() < busyEnd.getTime() && slotEnd.getTime() > busyStart.getTime();
                    });

                    if (!isOverlapping) {
                        const displayHour = slotStart.getUTCHours() + moscowOffset;
                        const displayMinute = slotStart.getUTCMinutes();
                        const timeString = `${String(displayHour).padStart(2, '0')}:${String(displayMinute).padStart(2, '0')}`;
                        availableSlots.push(timeString);
                    }
                }
            }

            if (availableSlots.length > 0) {
                return { 
                    success: true, 
                    today_date: today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
                    booking_date: targetDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
                    available_times: availableSlots 
                };
            }
        } catch (error) {
            console.error('Error checking availability with Google Calendar:', error);
            return { success: false, message: 'Произошла ошибка при проверке доступности в Google Календаре.' };
        }

        targetDate.setDate(targetDate.getDate() + 1);
    }

    return { success: false, message: 'К сожалению, в ближайший месяц нет свободных слотов.' };
}

async function bookServiceAppointment(params) {
    const {
        customer_name,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        service_type,
        datetime,
        problem_description,
    } = params;

    console.log(`[CALL] bookServiceAppointment: customer_name=${customer_name}, datetime=${datetime}`);
    const data = readData();
    const serviceCenterId = data.service_centers[0].id;

    const service = data.services.find(s => s.service_center_id === serviceCenterId && s.name.toLowerCase() === service_type.toLowerCase());
    if (!service) {
        return { success: false, message: `Услуга '${service_type}' не найдена.` };
    }

    const targetUTCDateTime = new Date(datetime);

    try {
        const event = {
            summary: `${service_type} для ${vehicle_make} ${vehicle_model} (${customer_name})`,
            description: `Описание проблемы: ${problem_description || service.description}`,
            start: { dateTime: targetUTCDateTime.toISOString(), timeZone: 'Europe/Moscow' },
            end: { dateTime: new Date(targetUTCDateTime.getTime() + service.estimated_duration_minutes * 60 * 1000).toISOString(), timeZone: 'Europe/Moscow' },
        };

        const response = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource: event,
        });
        
        console.log(`Successfully booked appointment with Google Event ID: ${response.data.id}`);

        return { success: true, google_event_link: response.data.htmlLink };

    } catch (error) {
        console.error("Error booking appointment with Google Calendar:", error.message);
        return { success: false, message: `Произошла техническая ошибка: не удалось создать запись.` };
    }
}

module.exports = {
    getAvailableServices,
    findFirstAvailableSlots,
    bookServiceAppointment,
};
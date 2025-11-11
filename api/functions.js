// api/functions.js
const { google } = require('googleapis');

// --- ЧИТАЕМ КЛЮЧИ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ---
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_REFRESH_TOKEN, CALENDAR_ID } = process.env;

// Проверяем, что все переменные окружения загружены
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI || !GOOGLE_REFRESH_TOKEN || !CALENDAR_ID) {
    console.error("FATAL ERROR: Missing Google Calendar environment variables.");
    // В реальном приложении здесь нужно было бы остановить запуск или вернуть ошибку
}

const oAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

async function findFirstAvailableSlots(service_type) {
    console.log(`[CALL] findFirstAvailableSlots: service_type='${service_type}'`);
    
    let today;
    try {
        today = new Date();
        console.log('[DEBUG] Current date is:', today);
    } catch (error) {
        console.error('[DEBUG] Error getting current date:', error);
        return { success: false, message: "Не удалось получить точное время для начала поиска." };
    }

    const serviceDurationMinutes = 90;
    const operatingHours = {
        "Пн-Пт": "9:00-19:00",
        "Сб": "Закрыто",
        "Вс": "Закрыто"
    };

    const targetDate = new Date(today.getTime());
    const todayDateString = today.toISOString().split('T')[0];

    for (let i = 0; i < 30; i++) {
        const datePart = targetDate.toISOString().split('T')[0];
        const dayOfWeek = targetDate.getDay();

        let hours = (dayOfWeek >= 1 && dayOfWeek <= 5) ? operatingHours['Пн-Пт'] : 'Закрыто';

        if (hours.toLowerCase() === 'закрыто') {
            targetDate.setDate(targetDate.getDate() + 1);
            continue;
        }

        try {
            const dayStart = new Date(datePart + 'T00:00:00Z');
            const dayEnd = new Date(datePart + 'T23:59:59Z');

            const response = await calendar.freebusy.query({
                requestBody: {
                    timeMin: dayStart.toISOString(),
                    timeMax: dayEnd.toISOString(),
                    items: [{ id: CALENDAR_ID }],
                },
            });

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

// Экспортируем только одну функцию, так как другие пока не используются
module.exports = {
    findFirstAvailableSlots,
};
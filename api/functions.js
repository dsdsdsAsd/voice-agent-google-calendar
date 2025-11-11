// api/functions.js
const { google } = require('googleapis');

// --- ВРЕМЕННЫЙ ХАК: ЖЕСТКО ПРОПИСЫВАЕМ КЛЮЧИ ---
const GOOGLE_CLIENT_ID = "219294752875-i09e62opfccophn5bgsmov7ocsl4sa5s.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";
const GOOGLE_REDIRECT_URI = "http://localhost:3000/oauth2callback";
const GOOGLE_REFRESH_TOKEN = "1//05VjC1VqOCXtBCgYIARAAGAUSNwF-L9IrmuMR9vN_r6U6NzD6W8u4AK-Sr_Yswu3XLtEoRkOOxLwM-kIG3wWTTw_TEb84HFC57a0";
const CALENDAR_ID = "kxander15@gmail.com";
// --- КОНЕЦ ХАКА ---

const oAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

async function findFirstAvailableSlots(service_type) {
    console.log(`[START] findFirstAvailableSlots for service: '${service_type}'`);
    
    let today;
    try {
        today = new Date();
        console.log(`[DEBUG] Current server date is: ${today.toISOString()}`);
    } catch (error) {
        console.error('[FATAL] Error getting current date:', error);
        return { success: false, message: "Не удалось получить точное время для начала поиска." };
    }

    const serviceDurationMinutes = 90;
    const operatingHours = { "Пн-Пт": "9:00-19:00", "Сб": "Закрыто", "Вс": "Закрыто" };
    const targetDate = new Date(today.getTime());

    for (let i = 0; i < 30; i++) {
        const datePart = targetDate.toISOString().split('T')[0];
        const dayOfWeek = targetDate.getDay();
        console.log(`
[LOOP ${i}] Checking date: ${datePart}, Day of week: ${dayOfWeek}`);

        let hours = (dayOfWeek >= 1 && dayOfWeek <= 5) ? operatingHours['Пн-Пт'] : 'Закрыто';
        if (hours.toLowerCase() === 'закрыто') {
            console.log(`[INFO] Day is closed. Skipping.`);
            targetDate.setDate(targetDate.getDate() + 1);
            continue;
        }

        try {
            const dayStart = new Date(`${datePart}T00:00:00.000Z`);
            const dayEnd = new Date(`${datePart}T23:59:59.999Z`);
            console.log(`[DEBUG] Google API timeMin: ${dayStart.toISOString()}, timeMax: ${dayEnd.toISOString()}`);

            const response = await calendar.freebusy.query({
                requestBody: {
                    timeMin: dayStart.toISOString(),
                    timeMax: dayEnd.toISOString(),
                    items: [{ id: CALENDAR_ID }],
                },
            });

            const busyTimes = response.data.calendars[CALENDAR_ID].busy;
            console.log(`[DEBUG] Found ${busyTimes.length} busy blocks from Google.`);
            if(busyTimes.length > 0) {
                busyTimes.forEach((b, index) => console.log(`  - Busy block ${index}: ${new Date(b.start).toISOString()} to ${new Date(b.end).toISOString()}`));
            }

            const availableSlots = [];
            const [startHourMSK, endHourMSK] = hours.split('-').map(h => parseInt(h.split(':')[0]));
            const moscowOffset = 3;
            const startHourUTC = startHourMSK - moscowOffset;
            const endHourUTC = endHourMSK - moscowOffset;
            const stepMinutes = 30;
            const [year, month, day] = datePart.split('-').map(Number);
            const endOfWorkingDay = new Date(Date.UTC(year, month - 1, day, endHourUTC, 0, 0));

            console.log(`[DEBUG] Checking slots from ${startHourUTC}:00 UTC to ${endHourUTC}:00 UTC.`);

            for (let hour = startHourUTC; hour < endHourUTC; hour++) {
                for (let minute = 0; minute < 60; minute += stepMinutes) {
                    const slotStart = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
                    if (slotStart.getTime() < today.getTime()) {
                        continue; // Пропускаем слоты в прошлом
                    }

                    const slotEnd = new Date(slotStart.getTime() + serviceDurationMinutes * 60 * 1000);
                    if (slotEnd.getTime() > endOfWorkingDay.getTime()) {
                        continue; // Пропускаем слоты, которые выходят за рамки рабочего дня
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
                console.log(`[SUCCESS] Found ${availableSlots.length} available slots. Returning result.`);
                return { 
                    success: true, 
                    today_date: today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
                    booking_date: targetDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
                    available_times: availableSlots 
                };
            } else {
                console.log(`[INFO] No available slots found for this day.`);
            }
        } catch (error) {
            console.error('[FATAL] Error checking availability with Google Calendar:', error);
            return { success: false, message: 'Произошла ошибка при проверке доступности в Google Календаре.' };
        }

        targetDate.setDate(targetDate.getDate() + 1);
    }

    console.log(`[FAIL] No slots found in the next 30 days. Returning empty-handed.`);
    return { success: false, message: 'К сожалению, в ближайший месяц нет свободных слотов.' };
}


module.exports = {
    findFirstAvailableSlots,
};

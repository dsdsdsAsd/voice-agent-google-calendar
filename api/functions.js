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

// ... (вспомогательные функции остаются без изменений) ...

async function findFirstAvailableSlots(service_type) {
    // ... (код этой функции не меняется) ...
}

async function bookServiceAppointment(booking_date_machine, booking_time_machine, user_name, vehicle_make, vehicle_model, vehicle_year) {
    console.log(`[START] bookServiceAppointment`);

    try {
        const car_details = [vehicle_make, vehicle_model, vehicle_year].filter(Boolean).join(' ');

        const [year, month, day] = booking_date_machine.split('-').map(Number);
        const [hour, minute] = booking_time_machine.split(':').map(Number);
        
        const moscowOffset = 3;
        const startHourUTC = hour - moscowOffset;
        const startMinuteUTC = minute;

        const startTime = new Date(Date.UTC(year, month - 1, day, startHourUTC, startMinuteUTC));
        const endTime = new Date(startTime.getTime() + 90 * 60 * 1000);

        const event = {
            summary: `Запись на сервис: ${user_name}`,
            description: `Клиент: ${user_name}\nАвтомобиль: ${car_details}\nУслуга: Диагностика`,
            start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
        };

        const response = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource: event,
        });

        console.log(`[SUCCESS] Event created: ${response.data.htmlLink}`);
        return { success: true, message: `Отлично, я записал вас.` };

    } catch (error) {
        console.error('[FATAL] Error creating event in Google Calendar:', error);
        return { success: false, message: 'К сожалению, не удалось создать запись. Произошла ошибка.' };
    }
}

module.exports = {
    findFirstAvailableSlots,
    bookServiceAppointment,
};
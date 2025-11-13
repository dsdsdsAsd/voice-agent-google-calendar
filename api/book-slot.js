// api/book-slot.js
const { bookServiceAppointment } = require('./functions.js');

module.exports = async (req, res) => {
    // Принимаем параметры на английском
    const { datetime, customer_name, vehicle_make, vehicle_model, vehicle_year, service_type } = req.body;

    // Проверяем, что ключевые параметры пришли
    if (!datetime || !customer_name || !vehicle_make) {
        console.error(`[ERROR] Missing required parameters. Received:`, req.body);
        return res.status(400).json({ success: false, message: 'Missing required parameters in request body.' });
    }

    // Парсим datetime из формата ISO
    const dateObj = new Date(datetime);
    const booking_date_machine = dateObj.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const booking_time_machine = dateObj.toTimeString().split(' ')[0].substring(0, 5); // "HH:MM"

    try {
        // Вызываем нашу основную функцию с отдельными параметрами
        const result = await bookServiceAppointment(booking_date_machine, booking_time_machine, customer_name, vehicle_make, vehicle_model, vehicle_year);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in book-slot API:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

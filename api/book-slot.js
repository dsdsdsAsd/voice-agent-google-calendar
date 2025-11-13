// api/book-slot.js
const { bookServiceAppointment } = require('./functions.js');

module.exports = async (req, res) => {
    // Принимаем параметры как два отдельных поля
    const { booking_date_machine, booking_time_machine, customer_name, vehicle_make, vehicle_model, vehicle_year } = req.body;

    // Собираем car_details, даже если модель отсутствует
    const car_details = [vehicle_make, vehicle_model, vehicle_year].filter(Boolean).join(' ');

    // Проверяем, что ключевые параметры пришли
    if (!booking_date_machine || !booking_time_machine || !customer_name || !car_details) {
        console.error(`[ERROR] Missing required parameters. Received:`, req.body);
        return res.status(400).json({ success: false, message: 'Missing required parameters in request body.' });
    }

    try {
        // Вызываем нашу основную функцию с машинными форматами
        const result = await bookServiceAppointment(booking_date_machine, booking_time_machine, customer_name, car_details);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in book-slot API:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
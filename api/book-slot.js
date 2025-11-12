// api/book-slot.js
const { bookServiceAppointment } = require('./functions.js');

module.exports = async (req, res) => {
    // Принимаем параметры с именами, которые отправляет Ultravox
    const { customer_name, vehicle_make, service_type, datetime, problem_description, vehicle_year } = req.body;

    // Разбираем datetime на дату и время
    // Предполагаем, что datetime приходит в формате "12 ноября 2025 г. 09:00"
    const datetimeParts = datetime.split(' ');
    const booking_date = datetimeParts.slice(0, 4).join(' '); // "12 ноября 2025 г."
    const booking_time = datetimeParts[4]; // "09:00"

    // Собираем car_details
    const car_details = `${vehicle_make} ${vehicle_year}`; // Модель не приходит, используем марку и год

    // Проверяем, что все нужные параметры пришли
    if (!booking_date || !booking_time || !customer_name || !car_details || !service_type) {
        console.error(`[ERROR] Missing parameters: date=${booking_date}, time=${booking_time}, name=${customer_name}, car=${car_details}, service=${service_type}`);
        return res.status(400).json({ success: false, message: 'Missing required parameters in request body.' });
    }

    // Проверяем, что service_type - "Диагностика"
    if (service_type !== "Диагностика") {
        console.error(`[ERROR] Unsupported service type: ${service_type}`);
        return res.status(400).json({ success: false, message: 'Unsupported service type. Only "Диагностика" is currently supported.' });
    }

    try {
        // Вызываем нашу основную функцию с правильными именами параметров
        const result = await bookServiceAppointment(booking_date, booking_time, customer_name, car_details);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in book-slot API:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

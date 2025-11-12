// api/book-slot.js
const { bookServiceAppointment } = require('./functions.js');

module.exports = async (req, res) => {
    const { booking_date, booking_time, user_name, car_details } = req.body;

    if (!booking_date || !booking_time || !user_name || !car_details) {
        return res.status(400).json({ success: false, message: 'Missing required parameters in request body.' });
    }

    try {
        const result = await bookServiceAppointment(booking_date, booking_time, user_name, car_details);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in book-slot API:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
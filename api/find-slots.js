// api/find-slots.js
const { findFirstAvailableSlots } = require('./functions.js');

module.exports = async (req, res) => {
    // Vercel автоматически парсит JSON-тело запроса в req.body
    const { service_type } = req.body;

    if (!service_type) {
        return res.status(400).json({ success: false, message: 'Missing service_type in request body.' });
    }

    try {
        const result = await findFirstAvailableSlots(service_type);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in find-slots API:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

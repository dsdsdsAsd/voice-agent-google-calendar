const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { findFirstAvailableSlots, getAvailableServices, bookServiceAppointment } = require('./functions.js');

const PORT = process.env.PORT || 8080;

// Создаем Express-приложение для HTTP-запросов
const app = express();

// Создаем HTTP-сервер
const server = http.createServer(app);

// Создаем WebSocket-сервер поверх HTTP-сервера
const wss = new WebSocket.Server({ server });

// Настраиваем "Health Check" эндпоинт
app.get('/', (req, res) => {
  res.status(200).send('Server is running and healthy.');
});

console.log(`[SERVER] HTTP and WebSocket server starting on port ${PORT}`);

wss.on('connection', (ws, req) => {
    // req.headers можно использовать для логирования заголовков, если нужно
    console.log('[SERVER] Ultravox connected to our server.');
    console.log('[SERVER] Connection headers:', req.headers);


    ws.on('message', async (data) => {
        // Первые 4 байта определяют тип сообщения
        const messageType = data.readUInt32LE(0);

        // 1 - Audio, 2 - Text (JSON)
        if (messageType === 2) {
            const messageStr = data.toString('utf-8', 4);
            try {
                const message = JSON.parse(messageStr);
                console.log('[SERVER] Received JSON message:', JSON.stringify(message, null, 2));

                if (message.type === 'DataConnectionToolInvocation') {
                    const { toolCallId, toolName, parameters } = message;
                    let result;

                    console.log(`[SERVER] Tool call received: ${toolName}`);

                    if (toolName === 'findFirstAvailableSlots') {
                        result = await findFirstAvailableSlots(parameters.service_type);
                    } else if (toolName === 'getAvailableServices') {
                        result = await getAvailableServices();
                    } else if (toolName === 'bookServiceAppointment') {
                        result = await bookServiceAppointment(parameters);
                    } else {
                        result = { success: false, message: `Tool ${toolName} not found.` };
                    }

                    const response = {
                        type: 'DataConnectionToolResult',
                        toolCallId: toolCallId,
                        result: result
                    };

                    const responseStr = JSON.stringify(response);
                    const responseBuffer = Buffer.from(responseStr, 'utf-8');
                    const finalBuffer = Buffer.alloc(4 + responseBuffer.length);
                    finalBuffer.writeUInt32LE(2, 0); // 2 for Text
                    responseBuffer.copy(finalBuffer, 4);

                    ws.send(finalBuffer);
                    console.log('[SERVER] Sent tool result:', JSON.stringify(response, null, 2));
                }
            } catch (error) {
                console.error('[SERVER] Error parsing JSON message or processing tool call:', error);
            }
        }
    });

    ws.on('close', () => {
        console.log('[SERVER] Ultravox disconnected.');
    });

    ws.on('error', (error) => {
        console.error('[SERVER] WebSocket error:', error);
    });
});

// Запускаем сервер
server.listen(PORT, () => {
    console.log(`[SERVER] Server is live and listening on port ${PORT}`);
    console.log('[SERVER] Waiting for connection from Ultravox...');
});

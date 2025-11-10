
const fetch = require('node-fetch');
const { spawn } = require('child_process');

// --- НАСТРОЙКИ ---
const AGENT_ID = 'b3e1efe3-a2da-4f79-99d9-d554a6ea74dd'; 
const API_KEY = 'aouwyYri.mv3WQhBlKEbi9U5NFMQlxEcmn1vz7olV'; 

// !!! ВАЖНО !!!
// Сюда нужно будет вставить URL, который выдаст Render
const MY_WEBSOCKET_URL = 'wss://voice-agent-google-calendar.onrender.com'; 
// ---

async function createCall() {
    console.log(`[start_call] Telling Ultravox to connect to our server at: ${MY_WEBSOCKET_URL}`);

    if (MY_WEBSOCKET_URL.includes('your-replit-url')) {
        console.error("[start_call] ERROR: Please update the MY_WEBSOCKET_URL variable in start_call.js");
        return;
    }

    const url = `https://api.ultravox.ai/api/agents/${AGENT_ID}/calls`;
    
    // Финальная версия тела запроса
    const body = {
        "dataConnection": {
            "websocketUrl": MY_WEBSOCKET_URL
        },
        "medium": {
            "serverWebSocket": {
                "inputSampleRate": 48000,
                "outputSampleRate": 48000
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-Key': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json();
        console.log('[start_call] Call creation request sent successfully.');
        console.log('[start_call] Ultravox should now be attempting to connect to your server.');
        console.log('[start_call] Response:', data);

    } catch (error) {
        console.error('[start_call] Error creating call:', error);
    }
}

createCall();

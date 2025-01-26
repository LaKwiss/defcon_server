"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ws_1 = require("ws");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/api/cities', async (_, res) => {
    try {
        const response = await fetch('https://raw.githubusercontent.com/lutangar/cities.json/master/cities.json', {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const rawCities = await response.json();
        const cities = rawCities.map((city) => ({
            name: city.name,
            latLng: {
                lat: parseFloat(city.lat),
                lng: parseFloat(city.lng),
            },
            population: 450,
            width: 100,
        }));
        res.json(cities);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
wss.on('connection', (ws) => {
    console.log('Connected');
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === ws_1.WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            });
        }
        catch (error) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid format' } }));
        }
    });
    ws.on('error', console.error);
    ws.on('close', () => console.log('Disconnected'));
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
server.listen(3000, () => console.log('Running on 3000'));

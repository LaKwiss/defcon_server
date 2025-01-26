import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocket, WebSocketServer, RawData } from 'ws';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface WebSocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

interface City {
  geonameid: number;
  name: string;
  asciiname: string;
  alternatenames: string[];
  latLng: { lat: number; lng: number };
  featureClass: string;
  featureCode: string;
  countryCode: string;
  population: number;
  timezone: string;
  width: number;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/cities', async (_, res) => {
  try {
    const rawData = await readFile(join(process.cwd(), 'cities.json'), 'utf-8');
    const citiesData = JSON.parse(rawData);

    const cities: City[] = citiesData.map((city: any) => ({
      geonameid: city.geonameid,
      name: city.name,
      asciiname: city.asciiname,
      alternatenames: city.alternatenames,
      latLng: {
        lat: city.latitude,
        lng: city.longitude,
      },
      featureClass: city.featureClass,
      featureCode: city.featureCode,
      countryCode: city.countryCode,
      population: city.population,
      timezone: city.timezone,
      width: 100,
    }));

    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Connected');

  ws.on('message', (data: RawData) => {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid format' } }));
    }
  });

  ws.on('error', console.error);
  ws.on('close', () => console.log('Disconnected'));
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

server.listen(3000, () => console.log('Running on 3000'));

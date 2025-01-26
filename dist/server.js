"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const promises_1 = require("fs/promises");
const node_cache_1 = __importDefault(require("node-cache"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(degrees) {
    return (degrees * Math.PI) / 180;
}
const cache = new node_cache_1.default({ stdTTL: 3600 });
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use('/api/', limiter);
async function getCitiesData() {
    const cacheKey = 'citiesData';
    let citiesData = cache.get(cacheKey);
    if (!citiesData) {
        const rawData = await (0, promises_1.readFile)('cities.json', 'utf-8');
        citiesData = JSON.parse(rawData);
        cache.set(cacheKey, citiesData);
    }
    return citiesData || [];
}
app.get('/api/cities', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        res.json(citiesData);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/cities/exact/:name/:index?', async (req, res) => {
    const { name, index = 0 } = req.params;
    try {
        const citiesData = await getCitiesData();
        const matches = citiesData.filter((c) => c.name === name);
        if (!matches.length) {
            return res.status(404).json({ error: `No city found: ${name}` });
        }
        if (Number(index) >= matches.length) {
            return res.status(404).json({ error: `Invalid index: ${index}` });
        }
        res.json(matches[Number(index)]);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/cities/geonameid/:id', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        const city = citiesData.find((c) => c.geonameid === Number(req.params.id));
        if (!city) {
            return res.status(404).json({ error: 'City not found' });
        }
        res.json(city);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/cities/country/:code', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        const minPopulation = Number(req.query.minPopulation) || 0;
        const cities = citiesData.filter((city) => city.countryCode.toLowerCase() === req.params.code.toLowerCase() &&
            city.population >= minPopulation);
        res.json(cities);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/cities/nearest/:lat/:lng/:radius', async (req, res) => {
    const { lat, lng, radius } = req.params;
    try {
        const citiesData = await getCitiesData();
        const nearby = citiesData.filter((city) => calculateHaversineDistance(Number(lat), Number(lng), city.latLng.lat, city.latLng.lng) <=
            Number(radius));
        res.json(nearby);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/cities/timezone/:zone', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        const cities = citiesData.filter((city) => city.timezone.includes(req.params.zone));
        res.json(cities);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/cities/language/:lang', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        const cities = citiesData.filter((city) => city.alternatenames.some((name) => name.toLowerCase().includes(req.params.lang.toLowerCase())));
        res.json(cities);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/cities/stats/:countryCode', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        const cities = citiesData.filter((city) => city.countryCode.toLowerCase() === req.params.countryCode.toLowerCase());
        if (!cities.length) {
            return res.status(404).json({ error: 'Country not found' });
        }
        const totalPop = cities.reduce((sum, city) => sum + city.population, 0);
        const avgPop = totalPop / cities.length;
        const sortedByPop = [...cities].sort((a, b) => b.population - a.population);
        res.json({
            totalPopulation: totalPop,
            averagePopulation: avgPop,
            cityCount: cities.length,
            largestCity: sortedByPop[0],
            smallestCity: sortedByPop[sortedByPop.length - 1],
            populationDensity: totalPop / cities.length,
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
};
app.use(errorHandler);
app.listen(3000, () => console.log('Running on 3000'));

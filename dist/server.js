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
    const R = 6371;
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
function computeTotalResources(cities) {
    return cities.reduce((acc, city) => ({
        oil: acc.oil + city.resources.oil,
        metal: acc.metal + city.resources.metal,
        crates: acc.crates + city.resources.crates,
        wheat: acc.wheat + city.resources.wheat,
        workforce: acc.workforce + city.resources.workforce,
        rareResources: acc.rareResources + city.resources.rareResources,
        money: acc.money + city.resources.money,
    }), {
        oil: 0,
        metal: 0,
        crates: 0,
        wheat: 0,
        workforce: 0,
        rareResources: 0,
        money: 0,
    });
}
const cache = new node_cache_1.default({ stdTTL: 3600 });
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 100 }));
async function getCitiesData() {
    const cacheKey = 'citiesData';
    let citiesData = cache.get(cacheKey);
    if (!citiesData) {
        const rawData = await (0, promises_1.readFile)('enriched_cities.json', 'utf-8');
        citiesData = JSON.parse(rawData);
        cache.set(cacheKey, citiesData);
    }
    return citiesData || [];
}
async function getCountriesData() {
    const cacheKey = 'countriesData';
    let countriesData = cache.get(cacheKey);
    if (!countriesData) {
        const rawData = await (0, promises_1.readFile)('countries.json', 'utf-8');
        countriesData = JSON.parse(rawData);
        cache.set(cacheKey, countriesData);
    }
    return countriesData || [];
}
// Routes existantes
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
        if (!matches.length)
            return res.status(404).json({ error: `No city found: ${name}` });
        if (Number(index) >= matches.length)
            return res.status(404).json({ error: `Invalid index: ${index}` });
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
        if (!city)
            return res.status(404).json({ error: 'City not found' });
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
// Nouvelles routes
app.get('/api/countries/:code', async (req, res) => {
    try {
        const countriesData = await getCountriesData();
        const country = countriesData.find((c) => c.code.toLowerCase() === req.params.code.toLowerCase() ||
            c.iso3.toLowerCase() === req.params.code.toLowerCase());
        if (!country)
            return res.status(404).json({ error: 'Pays non trouvé' });
        res.json(country);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/countries/:code/resources', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        const cities = citiesData.filter((city) => city.countryCode.toLowerCase() === req.params.code.toLowerCase());
        if (!cities.length) {
            return res.status(404).json({ error: 'Pays non trouvé' });
        }
        const resources = computeTotalResources(cities);
        res.json(resources);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/countries/:code/neighbours', async (req, res) => {
    try {
        const countriesData = await getCountriesData();
        const country = countriesData.find((c) => c.code.toLowerCase() === req.params.code.toLowerCase());
        if (!country)
            return res.status(404).json({ error: 'Pays non trouvé' });
        const neighbours = country.neighbours
            .split(',')
            .filter((n) => n.trim())
            .map((code) => countriesData.find((c) => c.code === code))
            .filter((c) => c !== undefined);
        res.json(neighbours);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/resources/continent/:code', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        const continentCities = citiesData.filter((city) => city.country.continent.toLowerCase() === req.params.code.toLowerCase());
        const resources = computeTotalResources(continentCities);
        const countriesCount = new Set(continentCities.map((c) => c.country.code)).size;
        res.json({
            continent: req.params.code,
            countriesCount,
            citiesCount: continentCities.length,
            totalPopulation: continentCities.reduce((sum, city) => sum + city.population, 0),
            resources,
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/cities/language/:lang', async (req, res) => {
    try {
        const citiesData = await getCitiesData();
        const cities = citiesData.filter((city) => city.country.languages.toLowerCase().includes(req.params.lang.toLowerCase()));
        res.json(cities);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
app.get('/api/countries/top/:resource/:limit?', async (req, res) => {
    try {
        const { resource, limit = 10 } = req.params;
        const citiesData = await getCitiesData();
        const countriesData = await getCountriesData();
        const countryResources = countriesData.map((country) => {
            const cities = citiesData.filter((city) => city.countryCode === country.code);
            const resources = computeTotalResources(cities);
            return {
                country,
                totalResource: resources[resource] || 0,
            };
        });
        const topCountries = countryResources
            .sort((a, b) => b.totalResource - a.totalResource)
            .slice(0, Number(limit));
        res.json(topCountries);
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

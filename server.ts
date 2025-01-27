import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { readFile } from 'fs/promises';
import NodeCache from 'node-cache';
import rateLimit from 'express-rate-limit';

interface Resources {
  oil: number;
  metal: number;
  crates: number;
  wheat: number;
  workforce: number;
  rareResources: number;
  money: number;
}

interface Doctrine {
  name: string;
  description: string;
}

interface Country {
  code: string;
  iso3: string;
  num: string;
  iso: string;
  name: string;
  capital: string;
  area: number;
  population: number;
  continent: string;
  tld: string;
  currency: string;
  currencyName: string;
  phone: string;
  postalCode: string;
  postalCodeRegex: string;
  languages: string;
  geonameid: number;
  neighbours: string;
  doctrine: Doctrine;
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
  resources: Resources;
  country: Country;
}

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function computeTotalResources(cities: City[]): Resources {
  return cities.reduce(
    (acc: Resources, city: City) => ({
      oil: acc.oil + city.resources.oil,
      metal: acc.metal + city.resources.metal,
      crates: acc.crates + city.resources.crates,
      wheat: acc.wheat + city.resources.wheat,
      workforce: acc.workforce + city.resources.workforce,
      rareResources: acc.rareResources + city.resources.rareResources,
      money: acc.money + city.resources.money,
    }),
    {
      oil: 0,
      metal: 0,
      crates: 0,
      wheat: 0,
      workforce: 0,
      rareResources: 0,
      money: 0,
    },
  );
}

const cache = new NodeCache({ stdTTL: 3600 });
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

async function getCitiesData(): Promise<City[]> {
  const cacheKey = 'citiesData';
  let citiesData = cache.get<City[]>(cacheKey);

  if (!citiesData) {
    const rawData = await readFile('enriched_cities.json', 'utf-8');
    citiesData = JSON.parse(rawData);
    cache.set(cacheKey, citiesData);
  }

  return citiesData || [];
}

async function getCountriesData(): Promise<Country[]> {
  const cacheKey = 'countriesData';
  let countriesData = cache.get<Country[]>(cacheKey);

  if (!countriesData) {
    const rawData = await readFile('countries.json', 'utf-8');
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
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/cities/exact/:name/:index?', async (req, res) => {
  const { name, index = 0 } = req.params;
  try {
    const citiesData = await getCitiesData();
    const matches = citiesData.filter((c) => c.name === name);
    if (!matches.length) return res.status(404).json({ error: `No city found: ${name}` });
    if (Number(index) >= matches.length)
      return res.status(404).json({ error: `Invalid index: ${index}` });
    res.json(matches[Number(index)]);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/cities/geonameid/:id', async (req, res) => {
  try {
    const citiesData = await getCitiesData();
    const city = citiesData.find((c) => c.geonameid === Number(req.params.id));
    if (!city) return res.status(404).json({ error: 'City not found' });
    res.json(city);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/cities/country/:code', async (req, res) => {
  try {
    const citiesData = await getCitiesData();
    const minPopulation = Number(req.query.minPopulation) || 0;
    const cities = citiesData.filter(
      (city) =>
        city.countryCode.toLowerCase() === req.params.code.toLowerCase() &&
        city.population >= minPopulation,
    );
    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Nouvelles routes
app.get('/api/countries/:code', async (req, res) => {
  try {
    const countriesData = await getCountriesData();
    const country = countriesData.find(
      (c) =>
        c.code.toLowerCase() === req.params.code.toLowerCase() ||
        c.iso3.toLowerCase() === req.params.code.toLowerCase(),
    );
    if (!country) return res.status(404).json({ error: 'Pays non trouvé' });
    res.json(country);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/countries/:code/resources', async (req, res) => {
  try {
    const citiesData = await getCitiesData();
    const cities = citiesData.filter(
      (city) => city.countryCode.toLowerCase() === req.params.code.toLowerCase(),
    );

    if (!cities.length) {
      return res.status(404).json({ error: 'Pays non trouvé' });
    }

    const resources = computeTotalResources(cities);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/countries/:code/neighbours', async (req, res) => {
  try {
    const countriesData = await getCountriesData();
    const country = countriesData.find(
      (c) => c.code.toLowerCase() === req.params.code.toLowerCase(),
    );
    if (!country) return res.status(404).json({ error: 'Pays non trouvé' });

    const neighbours = country.neighbours
      .split(',')
      .filter((n) => n.trim())
      .map((code) => countriesData.find((c) => c.code === code))
      .filter((c) => c !== undefined);

    res.json(neighbours);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/resources/continent/:code', async (req, res) => {
  try {
    const citiesData = await getCitiesData();
    const continentCities = citiesData.filter(
      (city) => city.country.continent.toLowerCase() === req.params.code.toLowerCase(),
    );

    const resources = computeTotalResources(continentCities);
    const countriesCount = new Set(continentCities.map((c) => c.country.code)).size;

    res.json({
      continent: req.params.code,
      countriesCount,
      citiesCount: continentCities.length,
      totalPopulation: continentCities.reduce((sum, city) => sum + city.population, 0),
      resources,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/cities/language/:lang', async (req, res) => {
  try {
    const citiesData = await getCitiesData();
    const cities = citiesData.filter((city) =>
      city.country.languages.toLowerCase().includes(req.params.lang.toLowerCase()),
    );
    res.json(cities);
  } catch (error) {
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
        totalResource: resources[resource as keyof Resources] || 0,
      };
    });

    const topCountries = countryResources
      .sort((a, b) => b.totalResource - a.totalResource)
      .slice(0, Number(limit));

    res.json(topCountries);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

app.use(errorHandler);
app.listen(3000, () => console.log('Running on 3000'));

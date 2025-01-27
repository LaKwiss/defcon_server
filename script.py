import json

def clean_cities():
    with open('enriched_cities.json', 'r', encoding='utf-8') as f:
        cities = json.load(f)
    
    cleaned_cities = []
    for city in cities:
        if 'alternatenames' in city:
            del city['alternatenames']
        cleaned_cities.append(city)
    
    with open('enriched_cities_clean.json', 'w', encoding='utf-8') as f:
        json.dump(cleaned_cities, f, ensure_ascii=False)

if __name__ == '__main__':
    clean_cities()
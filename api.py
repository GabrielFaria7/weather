import requests

URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search"
URL_PREVISAO = "https://api.open-meteo.com/v1/forecast"
URL_QUALIDADE_AR = "https://air-quality-api.open-meteo.com/v1/air-quality"

TEMPO_LIMITE = 10


def _converter_cidade(cidade):
    return {
        "id": cidade.get("id"),
        "nome": cidade["name"],
        "estado": cidade.get("admin1", ""),
        "pais": cidade.get("country", ""),
        "latitude": cidade["latitude"],
        "longitude": cidade["longitude"],
    }


def buscar_cidades(nome, quantidade=6):
    parametros = {"name": nome, "count": quantidade, "language": "pt", "format": "json"}
    resposta = requests.get(URL_GEOCODIFICACAO, params=parametros, timeout=TEMPO_LIMITE)
    resposta.raise_for_status()
    return [_converter_cidade(c) for c in resposta.json().get("results", [])]


def buscar_cidade(nome):
    cidades = buscar_cidades(nome, quantidade=1)
    return cidades[0] if cidades else None


def buscar_clima(latitude, longitude):
    parametros = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,"
        "wind_speed_10m,weather_code",
        "timezone": "auto",
    }
    resposta = requests.get(URL_PREVISAO, params=parametros, timeout=TEMPO_LIMITE)
    resposta.raise_for_status()
    return resposta.json()["current"]


def buscar_previsao(latitude, longitude):
    parametros = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": "auto",
        "forecast_days": 10,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,"
        "wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,is_day,"
        "pressure_msl,visibility,uv_index,precipitation",
        "hourly": "temperature_2m,weather_code,precipitation_probability,wind_speed_10m,is_day",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
        "precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset",
    }
    resposta = requests.get(URL_PREVISAO, params=parametros, timeout=TEMPO_LIMITE)
    resposta.raise_for_status()
    return resposta.json()


def buscar_qualidade_ar(latitude, longitude):
    parametros = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide",
    }
    resposta = requests.get(URL_QUALIDADE_AR, params=parametros, timeout=TEMPO_LIMITE)
    resposta.raise_for_status()
    return resposta.json()["current"]

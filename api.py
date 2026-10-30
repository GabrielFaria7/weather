import requests

URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search"
URL_PREVISAO = "https://api.open-meteo.com/v1/forecast"

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


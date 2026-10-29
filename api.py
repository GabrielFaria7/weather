"""Tudo que conversa com a internet (API Open-Meteo) fica aqui."""

import requests

URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search"
URL_PREVISAO = "https://api.open-meteo.com/v1/forecast"

# Tempo máximo (em segundos) esperando a resposta, para o app não ficar travado para sempre.
TEMPO_LIMITE = 10


def buscar_cidade(nome):
    """Transforma o nome de uma cidade em latitude/longitude.

    Devolve um dicionário com os dados da cidade, ou None se ela não for encontrada.
    """
    # Usar params= faz o requests cuidar de acentos e espaços (ex.: "São Paulo").
    parametros = {"name": nome, "count": 1, "language": "pt", "format": "json"}
    resposta = requests.get(URL_GEOCODIFICACAO, params=parametros, timeout=TEMPO_LIMITE)
    resposta.raise_for_status()  # Dá erro se a API respondeu com falha (ex.: erro 500)

    resultados = resposta.json().get("results")
    if not resultados:
        return None

    cidade = resultados[0]
    return {
        "nome": cidade["name"],
        "estado": cidade.get("admin1", ""),  # Algumas cidades não têm estado
        "pais": cidade.get("country", ""),
        "latitude": cidade["latitude"],
        "longitude": cidade["longitude"],
    }


def buscar_clima(latitude, longitude):
    """Busca o clima atual de uma posição e devolve o bloco "current" da resposta."""
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

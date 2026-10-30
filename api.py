"""Tudo que conversa com a internet (API Open-Meteo) fica aqui."""

import requests

URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search"
URL_PREVISAO = "https://api.open-meteo.com/v1/forecast"
URL_QUALIDADE_AR = "https://air-quality-api.open-meteo.com/v1/air-quality"

# Tempo máximo (em segundos) esperando a resposta, para o app não ficar travado para sempre.
TEMPO_LIMITE = 10


def _converter_cidade(cidade):
    """Deixa só os campos que usamos, com nomes em português."""
    return {
        "id": cidade.get("id"),
        "nome": cidade["name"],
        "estado": cidade.get("admin1", ""),  # Algumas cidades não têm estado
        "pais": cidade.get("country", ""),
        "latitude": cidade["latitude"],
        "longitude": cidade["longitude"],
    }


def buscar_cidades(nome, quantidade=6):
    """Devolve uma lista de cidades parecidas com o nome digitado (usada nas sugestões da web)."""
    # Usar params= faz o requests cuidar de acentos e espaços (ex.: "São Paulo").
    parametros = {"name": nome, "count": quantidade, "language": "pt", "format": "json"}
    resposta = requests.get(URL_GEOCODIFICACAO, params=parametros, timeout=TEMPO_LIMITE)
    resposta.raise_for_status()  # Dá erro se a API respondeu com falha (ex.: erro 500)
    return [_converter_cidade(c) for c in resposta.json().get("results", [])]


def buscar_cidade(nome):
    """Transforma o nome de uma cidade em latitude/longitude.

    Devolve um dicionário com os dados da cidade, ou None se ela não for encontrada.
    """
    cidades = buscar_cidades(nome, quantidade=1)
    return cidades[0] if cidades else None


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


def buscar_previsao(latitude, longitude):
    """Busca tudo que o painel web precisa: agora, as próximas horas e os próximos 10 dias."""
    parametros = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": "auto",  # Horários no fuso da cidade, não no do computador
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
    """Busca a qualidade do ar atual (índice europeu e poluentes)."""
    parametros = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide",
    }
    resposta = requests.get(URL_QUALIDADE_AR, params=parametros, timeout=TEMPO_LIMITE)
    resposta.raise_for_status()
    return resposta.json()["current"]

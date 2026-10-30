"""Tradução dos códigos de tempo da Open-Meteo (padrão WMO) para português."""

# Cada número que a API devolve em "weather_code" vira um texto em português.
DESCRICOES = {
    0: "Céu limpo",
    1: "Predominantemente limpo",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Nevoeiro",
    48: "Nevoeiro com geada",
    51: "Garoa leve",
    53: "Garoa moderada",
    55: "Garoa intensa",
    56: "Garoa congelante leve",
    57: "Garoa congelante intensa",
    61: "Chuva leve",
    63: "Chuva moderada",
    65: "Chuva forte",
    66: "Chuva congelante leve",
    67: "Chuva congelante forte",
    71: "Neve fraca",
    73: "Neve moderada",
    75: "Neve forte",
    77: "Grãos de neve",
    80: "Pancadas de chuva leves",
    81: "Pancadas de chuva moderadas",
    82: "Pancadas de chuva violentas",
    85: "Pancadas de neve leves",
    86: "Pancadas de neve fortes",
    95: "Trovoada",
    96: "Trovoada com granizo leve",
    99: "Trovoada com granizo forte",
}


def descrever(codigo):
    """Devolve a descrição em português. Se o código for estranho, não quebra o programa."""
    return DESCRICOES.get(codigo, "Condição desconhecida")


def icone(codigo):
    """Devolve um emoji que combina com o tempo."""
    if codigo == 0:
        return "☀️"
    if codigo in (1, 2):
        return "⛅"
    if codigo == 3:
        return "☁️"
    if codigo in (45, 48):
        return "🌫️"
    if codigo in (51, 53, 55, 56, 57):
        return "🌦️"
    if codigo in (61, 63, 65, 66, 67, 80, 81, 82):
        return "🌧️"
    if codigo in (71, 73, 75, 77, 85, 86):
        return "❄️"
    if codigo in (95, 96, 99):
        return "⛈️"
    return "❔"

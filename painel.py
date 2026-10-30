"""Transforma as respostas cruas da Open-Meteo no formato que a página web usa.

Aqui não tem internet: só organização de dados. Por isso é fácil de testar.
"""

from avisos import gerar_avisos
from descricoes import descrever

HORAS_NO_PAINEL = 24

# Faixas do índice europeu de qualidade do ar (European AQI).
NIVEIS_QUALIDADE_AR = [
    (20, "Boa"),
    (40, "Razoável"),
    (60, "Moderada"),
    (80, "Ruim"),
    (100, "Muito ruim"),
]


def classificar_qualidade_ar(indice):
    if indice is None:
        return None
    for limite, nome in NIVEIS_QUALIDADE_AR:
        if indice <= limite:
            return nome
    return "Extremamente ruim"


def _montar_horas(horas):
    """A API manda listas separadas (horários, temperaturas...). Juntamos em um item por hora."""
    return [
        {
            "horario": horas["time"][i],
            "temperatura": horas["temperature_2m"][i],
            "codigo": horas["weather_code"][i],
            "descricao": descrever(horas["weather_code"][i]),
            "chance_chuva": horas["precipitation_probability"][i],
            "vento": horas["wind_speed_10m"][i],
            "dia": bool(horas["is_day"][i]),
        }
        for i in range(len(horas["time"]))
    ]


def _montar_dias(diario, todas_as_horas):
    dias = []
    for i, data in enumerate(diario["time"]):
        dias.append({
            "data": data,
            "codigo": diario["weather_code"][i],
            "descricao": descrever(diario["weather_code"][i]),
            "max": diario["temperature_2m_max"][i],
            "min": diario["temperature_2m_min"][i],
            "chance_chuva": diario["precipitation_probability_max"][i],
            "chuva_mm": diario["precipitation_sum"][i],
            "vento_max": diario["wind_speed_10m_max"][i],
            "rajada_max": diario["wind_gusts_10m_max"][i],
            "uv_max": diario["uv_index_max"][i],
            "nascer": diario["sunrise"][i],
            "por": diario["sunset"][i],
            # As horas daquele dia, para o gráfico da janela de detalhes.
            "horas": [h for h in todas_as_horas if h["horario"].startswith(data)],
        })
    return dias


def _montar_qualidade_ar(ar):
    if not ar:
        return None
    return {
        "indice": ar.get("european_aqi"),
        "nivel": classificar_qualidade_ar(ar.get("european_aqi")),
        "pm2_5": ar.get("pm2_5"),
        "pm10": ar.get("pm10"),
        "ozonio": ar.get("ozone"),
        "dioxido_nitrogenio": ar.get("nitrogen_dioxide"),
    }


def montar_painel(local, previsao, ar=None):
    atual = previsao["current"]
    todas_as_horas = _montar_horas(previsao["hourly"])
    dias = _montar_dias(previsao["daily"], todas_as_horas)

    # A lista de horas começa à meia-noite; pulamos até a hora atual ("2026-10-29T17" == "2026-10-29T17").
    inicio = next(
        (i for i, h in enumerate(todas_as_horas) if h["horario"][:13] == atual["time"][:13]), 0
    )

    return {
        "local": local,
        "fuso": previsao.get("timezone", "UTC"),
        "atual": {
            "horario": atual["time"],
            "temperatura": atual["temperature_2m"],
            "sensacao": atual["apparent_temperature"],
            "umidade": atual["relative_humidity_2m"],
            "ponto_orvalho": atual["dew_point_2m"],
            "vento": atual["wind_speed_10m"],
            "direcao_vento": atual["wind_direction_10m"],
            "rajada": atual["wind_gusts_10m"],
            "codigo": atual["weather_code"],
            "descricao": descrever(atual["weather_code"]),
            "dia": bool(atual["is_day"]),
            "pressao": atual["pressure_msl"],
            "visibilidade": atual["visibility"],
            "uv": atual["uv_index"],
            "precipitacao": atual["precipitation"],
        },
        "por_hora": todas_as_horas[inicio:inicio + HORAS_NO_PAINEL],
        "dias": dias,
        "qualidade_ar": _montar_qualidade_ar(ar),
        "avisos": gerar_avisos(dias),
    }

"""Uma resposta da Open-Meteo inventada (2 dias, 48 horas), para os testes não usarem a internet."""


def previsao_falsa(chuva_mm=(2.0, 0.0), rajadas=(20.0, 15.0), maximas=(31.0, 30.0), minimas=(24.0, 23.0), codigos=(61, 2)):
    datas = ["2026-10-29", "2026-10-30"]
    horarios = [f"{d}T{h:02d}:00" for d in datas for h in range(24)]
    return {
        "timezone": "America/Manaus",
        "current": {
            "time": "2026-10-29T17:45", "temperature_2m": 29.4, "apparent_temperature": 33.1,
            "relative_humidity_2m": 80, "dew_point_2m": 25.0, "wind_speed_10m": 7.2,
            "wind_direction_10m": 90, "wind_gusts_10m": 18.0, "weather_code": 61, "is_day": 1,
            "pressure_msl": 1010.0, "visibility": 12000.0, "uv_index": 3.2, "precipitation": 0.4,
        },
        "hourly": {
            "time": horarios,
            "temperature_2m": [25.0 + (i % 24) / 4 for i in range(48)],
            "weather_code": [61] * 48,
            "precipitation_probability": [40] * 48,
            "wind_speed_10m": [8.0] * 48,
            "is_day": [1 if 6 <= i % 24 < 18 else 0 for i in range(48)],
        },
        "daily": {
            "time": datas,
            "weather_code": list(codigos),
            "temperature_2m_max": list(maximas),
            "temperature_2m_min": list(minimas),
            "precipitation_probability_max": [80, 10],
            "precipitation_sum": list(chuva_mm),
            "wind_speed_10m_max": [12.0, 10.0],
            "wind_gusts_10m_max": list(rajadas),
            "uv_index_max": [9.0, 10.0],
            "sunrise": ["2026-10-29T05:50", "2026-10-30T05:50"],
            "sunset": ["2026-10-29T18:05", "2026-10-30T18:05"],
        },
    }

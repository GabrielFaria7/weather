NIVEIS = ["atencao", "alerta", "perigo"]

DIAS_ANALISADOS = 3


def _rotulo_dia(indice, data):
    if indice == 0:
        return "hoje"
    if indice == 1:
        return "amanhã"
    ano, mes, dia = data.split("-")
    return f"em {dia}/{mes}"


def _avisos_do_dia(indice, dia):
    quando = _rotulo_dia(indice, dia["data"])
    chuva = dia["chuva_mm"] or 0
    chance = dia["chance_chuva"] or 0
    rajada = dia["rajada_max"] or 0
    avisos = []

    if chuva >= 50:
        avisos.append(("chuva", "perigo", "Chuva muito intensa", f"{chuva:.0f} mm previstos {quando}."))
    elif chuva >= 30:
        avisos.append(("chuva", "alerta", "Chuva intensa", f"{chuva:.0f} mm previstos {quando}."))
    elif chuva >= 15 and chance >= 70:
        avisos.append(("chuva", "atencao", "Chuva forte", f"{chuva:.0f} mm e {chance}% de chance {quando}."))

    if dia["codigo"] in (95, 96, 99):
        avisos.append(("tempestade", "alerta", "Tempestade", f"{dia['descricao']} prevista {quando}."))

    if rajada >= 100:
        avisos.append(("vento", "perigo", "Ventos muito fortes", f"Rajadas de até {rajada:.0f} km/h {quando}."))
    elif rajada >= 80:
        avisos.append(("vento", "alerta", "Ventos fortes", f"Rajadas de até {rajada:.0f} km/h {quando}."))
    elif rajada >= 60:
        avisos.append(("vento", "atencao", "Ventania", f"Rajadas de até {rajada:.0f} km/h {quando}."))

    if dia["max"] is not None and dia["max"] >= 38:
        avisos.append(("calor", "alerta", "Calor extremo", f"Máxima de {dia['max']:.0f} °C {quando}."))
    elif dia["max"] is not None and dia["max"] >= 35:
        avisos.append(("calor", "atencao", "Calor intenso", f"Máxima de {dia['max']:.0f} °C {quando}."))

    if dia["min"] is not None and dia["min"] <= 0:
        avisos.append(("frio", "alerta", "Frio extremo", f"Mínima de {dia['min']:.0f} °C {quando}."))
    elif dia["min"] is not None and dia["min"] <= 3:
        avisos.append(("frio", "atencao", "Frio intenso", f"Mínima de {dia['min']:.0f} °C {quando}."))

    return [
        {"tipo": tipo, "nivel": nivel, "titulo": titulo, "detalhe": detalhe, "data": dia["data"]}
        for tipo, nivel, titulo, detalhe in avisos
    ]


def gerar_avisos(dias):
    avisos = []
    for indice, dia in enumerate(dias[:DIAS_ANALISADOS]):
        avisos.extend(_avisos_do_dia(indice, dia))
    return sorted(avisos, key=lambda aviso: NIVEIS.index(aviso["nivel"]), reverse=True)

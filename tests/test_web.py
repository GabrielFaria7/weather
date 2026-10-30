import web
from tests.dados_falsos import previsao_falsa

LOCAL = {"nome": "Manaus", "estado": "Amazonas", "pais": "Brasil", "latitude": -3.1, "longitude": -60.0}
QUALIDADE_AR_FALSA = {"european_aqi": 35, "pm2_5": 10.2, "pm10": 18.0, "ozone": 50.0, "nitrogen_dioxide": 12.0}


def cliente():
    return web.app.test_client()


def montar(corpo):
    return cliente().post("/api/painel", json=corpo)


def test_pagina_abre():
    resposta = cliente().get("/")
    assert resposta.status_code == 200
    assert "<title>Weather</title>" in resposta.text


def test_painel_completo():
    resposta = montar({"local": LOCAL, "previsao": previsao_falsa(), "ar": QUALIDADE_AR_FALSA})
    dados = resposta.json
    assert resposta.status_code == 200
    assert dados["local"]["nome"] == "Manaus"
    assert dados["atual"]["descricao"] == "Chuva leve"
    assert len(dados["por_hora"]) == 24
    assert dados["qualidade_ar"]["nivel"] == "Razoável"


def test_painel_sem_qualidade_do_ar():
    local = {"latitude": -3.1, "longitude": -60.0}
    dados = montar({"local": local, "previsao": previsao_falsa(), "ar": None}).json
    assert dados["qualidade_ar"] is None
    assert dados["local"]["nome"] == "Sua localização"


def test_coordenadas_invalidas():
    assert montar({"local": {"latitude": "abc", "longitude": 1}, "previsao": previsao_falsa()}).status_code == 400
    assert montar({"local": {"latitude": 200, "longitude": 1}, "previsao": previsao_falsa()}).status_code == 400


def test_sem_json():
    resposta = cliente().post("/api/painel", data="isso não é json")
    assert resposta.status_code == 400
    assert "JSON" in resposta.json["erro"]


def test_previsao_incompleta():
    previsao = previsao_falsa()
    del previsao["daily"]
    resposta = montar({"local": LOCAL, "previsao": previsao})
    assert resposta.status_code == 400
    assert "incompletos" in resposta.json["erro"]


def test_previsao_com_formato_inesperado():
    previsao = previsao_falsa()
    del previsao["current"]["weather_code"]
    resposta = montar({"local": LOCAL, "previsao": previsao})
    assert resposta.status_code == 400
    assert "formato inesperado" in resposta.json["erro"]


def test_nome_muito_longo_e_cortado():
    local = {**LOCAL, "nome": "x" * 500}
    assert len(montar({"local": local, "previsao": previsao_falsa()}).json["local"]["nome"]) == 100

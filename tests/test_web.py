import requests

import web
from tests.dados_falsos import previsao_falsa

QUALIDADE_AR_FALSA = {"european_aqi": 35, "pm2_5": 10.2, "pm10": 18.0, "ozone": 50.0, "nitrogen_dioxide": 12.0}


def cliente():
    return web.app.test_client()


def test_pagina_abre():
    resposta = cliente().get("/")
    assert resposta.status_code == 200
    assert "<title>Weather</title>" in resposta.text


def test_sugestoes_de_cidades(monkeypatch):
    monkeypatch.setattr(web, "buscar_cidades", lambda termo: [{"nome": "Recife", "estado": "Pernambuco"}])
    resposta = cliente().get("/api/cidades?q=rec")
    assert resposta.json == [{"nome": "Recife", "estado": "Pernambuco"}]


def test_sugestoes_ignoram_texto_curto():
    assert cliente().get("/api/cidades?q=a").json == []


def test_previsao_completa(monkeypatch):
    monkeypatch.setattr(web, "buscar_previsao", lambda lat, lon: previsao_falsa())
    monkeypatch.setattr(web, "buscar_qualidade_ar", lambda lat, lon: QUALIDADE_AR_FALSA)
    resposta = cliente().get("/api/previsao?lat=-3.1&lon=-60&nome=Manaus&estado=Amazonas&pais=Brasil")
    dados = resposta.json
    assert resposta.status_code == 200
    assert dados["local"]["nome"] == "Manaus"
    assert dados["atual"]["descricao"] == "Chuva leve"
    assert dados["qualidade_ar"]["nivel"] == "Razoável"


def test_previsao_sem_qualidade_do_ar_continua_funcionando(monkeypatch):
    def falhar(lat, lon):
        raise requests.ConnectionError()

    monkeypatch.setattr(web, "buscar_previsao", lambda lat, lon: previsao_falsa())
    monkeypatch.setattr(web, "buscar_qualidade_ar", falhar)
    resposta = cliente().get("/api/previsao?lat=-3.1&lon=-60")
    assert resposta.status_code == 200
    assert resposta.json["qualidade_ar"] is None
    assert resposta.json["local"]["nome"] == "Sua localização"


def test_coordenadas_invalidas():
    assert cliente().get("/api/previsao?lat=abc&lon=1").status_code == 400
    assert cliente().get("/api/previsao?lat=200&lon=1").status_code == 400


def test_sem_internet(monkeypatch):
    def falhar(lat, lon):
        raise requests.ConnectionError()

    monkeypatch.setattr(web, "buscar_previsao", falhar)
    resposta = cliente().get("/api/previsao?lat=-3.1&lon=-60")
    assert resposta.status_code == 502
    assert "internet" in resposta.json["erro"]

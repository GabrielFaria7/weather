import requests

import web

# Respostas "falsas" para o teste não depender da internet.
CIDADE_FALSA = {"nome": "Manaus", "estado": "Amazonas", "pais": "Brasil", "latitude": -3.1, "longitude": -60.0}
CLIMA_FALSO = {
    "temperature_2m": 29.4,
    "apparent_temperature": 33.1,
    "relative_humidity_2m": 80,
    "wind_speed_10m": 7.2,
    "weather_code": 61,
}


def test_pagina_abre():
    cliente = web.app.test_client()
    resposta = cliente.get("/")
    assert resposta.status_code == 200
    assert "Aventura do Clima" in resposta.text


def test_mostra_o_clima(monkeypatch):
    monkeypatch.setattr(web, "buscar_cidade", lambda nome: CIDADE_FALSA)
    monkeypatch.setattr(web, "buscar_clima", lambda lat, lon: CLIMA_FALSO)
    resposta = web.app.test_client().post("/", data={"cidade": "Manaus"})
    assert "Chuva leve" in resposta.text
    assert "29.4 °C" in resposta.text
    assert "Manaus, Amazonas - Brasil" in resposta.text


def test_cidade_nao_encontrada(monkeypatch):
    monkeypatch.setattr(web, "buscar_cidade", lambda nome: None)
    resposta = web.app.test_client().post("/", data={"cidade": "Xyzabc"})
    assert "A selva não conhece esse lugar" in resposta.text


def test_sem_internet(monkeypatch):
    def falhar(nome):
        raise requests.ConnectionError()

    monkeypatch.setattr(web, "buscar_cidade", falhar)
    resposta = web.app.test_client().post("/", data={"cidade": "Manaus"})
    assert "sem conexão" in resposta.text

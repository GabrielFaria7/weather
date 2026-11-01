import web


def cliente():
    return web.app.test_client()


def test_pagina_abre():
    resposta = cliente().get("/")
    assert resposta.status_code == 200
    assert "<title>Weather</title>" in resposta.text


def test_arquivos_do_site():
    assert cliente().get("/css/app.css").status_code == 200
    assert cliente().get("/js/main.js").status_code == 200
    assert cliente().get("/js/painel.js").status_code == 200


def test_servidor_nao_monta_mais_o_painel():
    assert cliente().post("/api/painel", json={}).status_code in (404, 405)

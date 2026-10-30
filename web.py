"""Servidor da interface web "Weather". Rode com: python web.py e abra http://127.0.0.1:5000

O Python só entrega dados (JSON). Quem desenha a tela é o JavaScript em static/js/.
"""

import requests
from flask import Flask, jsonify, render_template, request

from api import buscar_cidades, buscar_previsao, buscar_qualidade_ar
from painel import montar_painel

app = Flask(__name__)

ERRO_CONEXAO = "Não foi possível falar com o serviço de meteorologia. Verifique sua internet."


@app.get("/")
def inicio():
    return render_template("index.html")


@app.get("/api/cidades")
def api_cidades():
    """Sugestões para o campo de busca. Ex.: /api/cidades?q=recife"""
    termo = request.args.get("q", "").strip()
    if len(termo) < 2:
        return jsonify([])
    try:
        return jsonify(buscar_cidades(termo))
    except requests.RequestException:
        return jsonify({"erro": ERRO_CONEXAO}), 502


@app.get("/api/previsao")
def api_previsao():
    """Painel completo de um lugar. Ex.: /api/previsao?lat=-8.05&lon=-34.9&nome=Recife"""
    try:
        latitude = float(request.args["lat"])
        longitude = float(request.args["lon"])
    except (KeyError, ValueError):
        return jsonify({"erro": "Informe latitude e longitude válidas."}), 400
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return jsonify({"erro": "Coordenadas fora do mapa."}), 400

    local = {
        "nome": request.args.get("nome") or "Sua localização",
        "estado": request.args.get("estado", ""),
        "pais": request.args.get("pais", ""),
        "latitude": latitude,
        "longitude": longitude,
    }

    try:
        previsao = buscar_previsao(latitude, longitude)
    except requests.RequestException:
        return jsonify({"erro": ERRO_CONEXAO}), 502

    # A qualidade do ar é um extra: se falhar, o resto do painel continua funcionando.
    try:
        ar = buscar_qualidade_ar(latitude, longitude)
    except requests.RequestException:
        ar = None

    return jsonify(montar_painel(local, previsao, ar))


if __name__ == "__main__":
    # debug=True recarrega o servidor sozinho quando você salva um arquivo.
    app.run(debug=True)

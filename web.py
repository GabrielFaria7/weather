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
    termo = request.args.get("q", "").strip()
    if len(termo) < 2:
        return jsonify([])
    try:
        return jsonify(buscar_cidades(termo))
    except requests.RequestException:
        return jsonify({"erro": ERRO_CONEXAO}), 502


@app.get("/api/previsao")
def api_previsao():
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

    try:
        ar = buscar_qualidade_ar(latitude, longitude)
    except requests.RequestException:
        ar = None

    return jsonify(montar_painel(local, previsao, ar))


if __name__ == "__main__":
    app.run(debug=True)

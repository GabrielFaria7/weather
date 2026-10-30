import requests
from flask import Flask, jsonify, render_template, request

from api import buscar_cidades, buscar_previsao, buscar_qualidade_ar
from painel import montar_painel

app = Flask(__name__)

ERRO_CONEXAO = "Não foi possível falar com o serviço de meteorologia. Verifique sua internet."
ERRO_DEMORA = "O serviço de meteorologia demorou demais para responder. Tente de novo em instantes."
ERRO_LIMITE = "O limite de consultas ao serviço de meteorologia foi atingido. Tente de novo mais tarde."
ERRO_RECUSADO = "O serviço de meteorologia recusou o pedido."


def responder_erro_api(erro):
    resposta = getattr(erro, "response", None)
    status = resposta.status_code if resposta is not None else None
    motivo = ""
    if resposta is not None:
        try:
            motivo = resposta.json().get("reason", "")
        except ValueError:
            motivo = resposta.text[:200]

    app.logger.warning("Falha ao consultar a Open-Meteo: %s status=%s motivo=%s", type(erro).__name__, status, motivo)

    if isinstance(erro, requests.Timeout):
        mensagem = ERRO_DEMORA
    elif status == 429:
        mensagem = ERRO_LIMITE
    elif status is not None:
        mensagem = f"{ERRO_RECUSADO} (código {status})"
    else:
        mensagem = ERRO_CONEXAO

    detalhe = f"{type(erro).__name__}" + (f" {status}" if status else "") + (f": {motivo}" if motivo else "")
    return jsonify({"erro": mensagem, "detalhe": detalhe}), 502


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
    except requests.RequestException as erro:
        return responder_erro_api(erro)


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
    except requests.RequestException as erro:
        return responder_erro_api(erro)

    try:
        ar = buscar_qualidade_ar(latitude, longitude)
    except requests.RequestException as erro:
        app.logger.warning("Qualidade do ar indisponível: %s", type(erro).__name__)
        ar = None

    return jsonify(montar_painel(local, previsao, ar))


if __name__ == "__main__":
    app.run(debug=True)

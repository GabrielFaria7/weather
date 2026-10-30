from flask import Flask, jsonify, render_template, request

from painel import montar_painel

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024

BLOCOS_DA_PREVISAO = ("current", "hourly", "daily")


def texto(valor, padrao=""):
    return str(valor)[:100] if valor else padrao


@app.get("/")
def inicio():
    return render_template("index.html")


@app.post("/api/painel")
def api_painel():
    corpo = request.get_json(silent=True)
    if not isinstance(corpo, dict):
        return jsonify({"erro": "Envie os dados da previsão em JSON."}), 400

    local_recebido = corpo.get("local")
    if not isinstance(local_recebido, dict):
        return jsonify({"erro": "Informe o local da previsão."}), 400
    try:
        latitude = float(local_recebido["latitude"])
        longitude = float(local_recebido["longitude"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"erro": "Informe latitude e longitude válidas."}), 400
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return jsonify({"erro": "Coordenadas fora do mapa."}), 400

    previsao = corpo.get("previsao")
    if not isinstance(previsao, dict) or not all(isinstance(previsao.get(b), dict) for b in BLOCOS_DA_PREVISAO):
        return jsonify({"erro": "Os dados da previsão vieram incompletos."}), 400

    ar = corpo.get("ar") if isinstance(corpo.get("ar"), dict) else None

    local = {
        "nome": texto(local_recebido.get("nome"), "Sua localização"),
        "estado": texto(local_recebido.get("estado")),
        "pais": texto(local_recebido.get("pais")),
        "latitude": latitude,
        "longitude": longitude,
    }

    try:
        return jsonify(montar_painel(local, previsao, ar))
    except (KeyError, IndexError, TypeError, ValueError):
        app.logger.warning("Dados da previsão em formato inesperado", exc_info=True)
        return jsonify({"erro": "Os dados da previsão vieram em um formato inesperado."}), 400


if __name__ == "__main__":
    app.run(debug=True)

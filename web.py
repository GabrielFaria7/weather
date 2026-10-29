"""Interface web com tema de selva. Rode com: python web.py e abra http://127.0.0.1:5000"""

import requests
from flask import Flask, render_template, request

from api import buscar_cidade, buscar_clima
from descricoes import descrever, icone, tem_chuva
from interface import nome_completo

app = Flask(__name__)


@app.route("/", methods=["GET", "POST"])
def inicio():
    # GET = a pessoa só abriu a página. POST = ela enviou o formulário.
    if request.method == "GET":
        return render_template("index.html")

    nome = request.form.get("cidade", "").strip()
    if not nome:
        return render_template("index.html", erro="🍃 Escreva o nome de uma cidade para começar a aventura.")

    try:
        cidade = buscar_cidade(nome)
        if cidade is None:
            return render_template(
                "index.html", busca=nome, erro=f"🐍 A selva não conhece esse lugar: “{nome}”."
            )
        clima = buscar_clima(cidade["latitude"], cidade["longitude"])
    except requests.RequestException:
        return render_template(
            "index.html", busca=nome, erro="🥁 Os tambores ficaram em silêncio (sem conexão). Tente de novo."
        )

    codigo = clima["weather_code"]
    return render_template(
        "index.html",
        busca=nome,
        local=nome_completo(cidade),
        clima=clima,
        descricao=descrever(codigo),
        icone=icone(codigo),
        chuva=tem_chuva(codigo),
    )


if __name__ == "__main__":
    # debug=True recarrega o servidor sozinho quando você salva um arquivo.
    app.run(debug=True)

import requests

from api import buscar_cidade, buscar_clima
from interface import mostrar_clima


def main():
    print("☀️  App de Clima (dados: Open-Meteo)")
    while True:
        try:
            nome = input("Digite uma cidade (ou 'sair'): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAté logo! 👋")
            break

        if not nome:
            continue
        if nome.lower() == "sair":
            print("Até logo! 👋")
            break

        try:
            cidade = buscar_cidade(nome)
            if cidade is None:
                print(f"❌ Cidade não encontrada: {nome}\n")
                continue
            clima = buscar_clima(cidade["latitude"], cidade["longitude"])
        except requests.RequestException:
            print("⚠️  Erro de conexão, verifique sua internet.\n")
            continue

        mostrar_clima(cidade, clima)


if __name__ == "__main__":
    main()

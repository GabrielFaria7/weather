# App de Clima 🌿

Mostra o clima atual de qualquer cidade usando a API gratuita [Open-Meteo](https://open-meteo.com/) (sem chave).
Tem duas formas de usar: no terminal e numa página web com tema de selva.

## Instalação (Ubuntu)

```bash
sudo apt install python3-venv   # só se ainda não tiver
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Como usar

Terminal:
```bash
python main.py
```

Web:
```bash
python web.py
```
Depois, abra http://127.0.0.1:5000 no navegador.

## Testes

```bash
pytest
```

## Arquivos

| Arquivo | O que faz |
|---|---|
| `api.py` | Busca a cidade e o clima na Open-Meteo |
| `descricoes.py` | Traduz o código do tempo para português e escolhe o emoji |
| `interface.py` | Mostra o resultado no terminal |
| `main.py` | App do terminal |
| `web.py` + `templates/` + `static/` | App web |

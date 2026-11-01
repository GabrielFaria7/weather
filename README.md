# Weather 🌤️

Mostra o clima de qualquer cidade usando a API gratuita [Open-Meteo](https://open-meteo.com/) (sem chave).
Tem duas formas de usar: no terminal e num painel web completo.

**Acesse o painel online:** https://gabrielfaria7.github.io/weather/

> O painel é um site estático no GitHub Pages: abre na hora, sem servidor para "acordar".
> A cópia antiga no Render (https://weather-jdpm.onrender.com/) continua no ar, mas pode levar cerca de 1 minuto para abrir.

## Prints

**Painel web (modo claro)**

![Painel web no modo claro mostrando o clima atual de São Paulo e a previsão por hora](docs/painel-claro.png)

**Painel completo (modo escuro)**

![Painel web no modo escuro com clima atual, previsão por hora, 10 dias, indicadores, qualidade do ar e mapa](docs/painel-escuro.png)

<table>
  <tr>
    <td width="35%"><strong>No celular</strong><br><img src="docs/celular.png" alt="Painel no celular, com os cards empilhados"></td>
    <td><strong>Tela inicial</strong><br><img src="docs/inicio.png" alt="Tela inicial com busca, botão de localização e cidades sugeridas"></td>
  </tr>
</table>

### Mapa com vento e nuvens

<table>
  <tr>
    <td width="50%"><strong>Vento (modo escuro)</strong><br><img src="docs/mapa-vento.png" alt="Mapa do Rio de Janeiro no modo escuro com partículas coloridas mostrando a previsão do vento"></td>
    <td width="50%"><strong>Nuvens (modo claro)</strong><br><img src="docs/mapa-nuvens.png" alt="Mapa do Rio de Janeiro no modo claro com as nuvens da imagem de satélite GOES-East por cima"></td>
  </tr>
</table>

**No terminal**

```
$ python main.py
☀️  App de Clima (dados: Open-Meteo)
Digite uma cidade (ou 'sair'): São Paulo

📍 São Paulo, São Paulo - Brasil
🌡️  Temperatura:      18.6 °C
🤔 Sensação térmica: 20.6 °C
💧 Umidade:          95 %
💨 Vento:            5.2 km/h
🌦️  Tempo:            Garoa intensa
```

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
Depois, abra http://127.0.0.1:5000 no navegador. Como o painel é só HTML, CSS e JavaScript (pasta `site/`),
qualquer servidor de arquivos também serve, por exemplo `python3 -m http.server -d site 8000`.

O painel web tem: clima atual, previsão por hora com gráfico, 10 dias (clique em um dia para ver
detalhes), indicadores (UV, pressão, visibilidade, sol...), qualidade do ar, alertas automáticos,
mapa com vento e nuvens animados, cidades favoritas, °C/°F, modo claro/escuro e localização atual.

> Os **alertas** são calculados a partir da previsão e **não são oficiais**.
> No **mapa**, a camada **Vento** mostra a previsão da Open-Meteo animada (não é medição em tempo real) e a
> camada **Nuvens** mostra imagens reais de satélite do mundo todo (menos perto dos polos): GOES (NOAA, via NASA GIBS)
> nas Américas e Meteosat MTG (EUMETSAT) na Europa, África e Oriente Médio, a cada 10 minutos; na Ásia e Oceania,
> o mosaico de satélites geoestacionários da EUMETSAT, a cada 3 horas.

## Publicar

O painel web é um **site estático**: a pasta `site/` tem tudo (HTML, CSS e JavaScript). O navegador de cada
visitante consulta a Open-Meteo e monta o painel sozinho, sem servidor. Assim cada pessoa usa o próprio limite
gratuito da API e o site abre na hora.

**GitHub Pages (principal):** a cada `git push` no `main`, o GitHub Actions roda os testes e, se passarem,
publica a pasta `site/` em https://gabrielfaria7.github.io/weather/ (`.github/workflows/testes.yml`).
Para ativar num repositório novo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

**Render (cópia antiga):** o `render.yaml` sobe o `web.py`, um servidor Flask que só entrega os arquivos de `site/`.
O Render publica depois que os testes passam (`autoDeployTrigger: checksPass`). No plano gratuito ele "dorme" após
um tempo sem acessos, e a primeira visita depois disso demora cerca de 1 minuto.

## Testes

Python (app do terminal e servidor) — as ferramentas de teste ficam em `requirements-dev.txt`:

```bash
pip install -r requirements-dev.txt
pytest
```

JavaScript (montagem do painel e alertas) — usa o executor de testes que já vem no Node.js 22 ou mais novo:

```bash
node --test "tests/js/*.test.mjs"
```

A cada push no `main` (e em cada pull request), o GitHub Actions roda os dois sozinho
(`.github/workflows/testes.yml`). O site só é publicado se todos passarem.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `api.py` | Busca cidades e o clima atual na Open-Meteo (app do terminal) |
| `descricoes.py` | Traduz o código do tempo para português (app do terminal) |
| `interface.py` + `main.py` | App do terminal |
| `web.py` | Servidor Flask que só entrega os arquivos de `site/` (usado no Render e para rodar localmente) |
| `site/index.html` | Estrutura da página (cabeçalho, abas) |
| `site/css/app.css` | Visual, temas claro/escuro e responsividade |
| `site/js/main.js` | Junta tudo: estado da página e eventos |
| `site/js/servico.js` | Consulta a Open-Meteo direto do navegador (camada de dados) |
| `site/js/painel.js` | Organiza os dados da API no formato do painel |
| `site/js/avisos.js` | Calcula os alertas automáticos (chuva, vento, calor, frio) |
| `site/js/descricoes.js` | Traduz o código do tempo para português |
| `site/js/componentes/` | Uma parte da tela por arquivo (card atual, por hora, 10 dias, mapa...) |
| `tests/` | Testes em Python (`pytest`) e em JavaScript (`tests/js/`, `node --test`) |

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).

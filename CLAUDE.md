# CLAUDE.md

App de clima em Python com dados da Open-Meteo (gratuita, sem chave). Tem duas interfaces:
um app de terminal e um painel web chamado **Weather**, publicado no Render.
Repositório: https://github.com/GabrielFaria7/weather (branch principal `main`).

## Comandos

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python main.py                                 # app do terminal
python web.py                                  # painel web em http://127.0.0.1:5000
gunicorn web:app --bind 0.0.0.0:8000           # igual ao servidor do Render
pytest                                         # testes (pytest.ini já ajusta o pythonpath)
```

## Arquitetura

- **Terminal:** `main.py` → `api.py` (`buscar_cidade`, `buscar_clima`, via `requests`) → `interface.py`.
- **Web:** o **navegador** consulta a Open-Meteo direto (`static/js/servico.js`: geocodificação,
  previsão de 10 dias e qualidade do ar) e envia os dados brutos para `POST /api/painel` (`web.py`).
  O servidor monta o painel em Python (`painel.py`, `avisos.py`, `descricoes.py`) e devolve JSON.
  O front desenha tudo com módulos ES em `static/js/componentes/` (um arquivo por seção da tela).
- **Sem build no front:** HTML/CSS/JS puros. Chart.js e Leaflet vêm de CDN em `templates/index.html`.
  Não há Node no ambiente; não migrar para React/Vite sem pedido explícito.

## Decisões importantes (não desfazer)

- **O servidor não deve consultar a Open-Meteo na versão web.** No Render gratuito, o IP de saída
  é compartilhado com outros sites e a Open-Meteo respondia `429 Daily API request limit exceeded`.
  Por isso o navegador de cada visitante faz as consultas (a Open-Meteo libera CORS).
- **Alertas são automáticos, não oficiais.** `avisos.py` calcula a partir da previsão e a interface
  deixa isso claro, com link para o INMET. Nunca apresentar como alerta oficial.
- **O mapa tem só as camadas Nuvens e Vento**, ambas com dados reais. Radar de chuva, Temperatura e Precipitação
  já foram integradas (RainViewer e grade da Open-Meteo) e removidas a pedido, porque o resultado não agradou.
  Não recolocar sem pedido. Nunca simular dados no mapa.
- **Vento animado:** `buscarVentoGrade` (`servico.js`) pede à Open-Meteo, pelo navegador, uma grade de
  13 × 13 pontos (±3°, passo 0,5°) para as próximas 24 h, só quando o usuário liga a camada (cache de 30 min).
  `mapa.js` converte velocidade/direção em u/v e desenha com `leaflet-velocity@1.9.2` (última versão MIT;
  a 2.x mudou de licença). A interface diz que é previsão do modelo, não medição em tempo real.
- **Nuvens animadas:** imagens reais de satélite, todas grátis, sem chave e com CORS. `SATELITES` (`mapa.js`) escolhe
  a fonte pela longitude da cidade: GOES-West e GOES-East GeoColor pela NASA GIBS (WMTS, 12 quadros a cada 10 min,
  ~1 h de atraso); Meteosat MTG infravermelho `mtg_fd:ir105_hrfi` na Europa/África/Oriente Médio (−15° a 60°) e o
  mosaico global infravermelho `mumi:worldcloudmap_ir108` na Ásia/Oceania (60° a 180°, 8 quadros a cada 3 h), ambos
  pelo WMS da EUMETSAT (`view.eumetsat.int/geoserver`). `buscarHorariosSatelite` (`servico.js`) lê os horários
  (DescribeDomains na GIBS, GetCapabilities da camada na EUMETSAT) e `ultimosHorarios` pega só os últimos.
  `urlTileSatelite` devolve uma função que monta a URL de cada tile (na EUMETSAT, calcula o bbox em EPSG:3857).
  `mapa.js` cria uma `L.gridLayer` por horário num painel próprio (`nuvens`, fora do `.leaflet-tile-pane`, que
  recebe o filtro de escurecer o mapa) e transforma o brilho de cada pixel em transparência (limites por satélite em
  `brilho`), para sobrar só as nuvens. Pixels de tom quente (luzes das cidades à noite no GeoColor, deserto de dia)
  são descartados. No MTG não usar `rgb_geocolour`: à noite as luzes das cidades grandes ficam brancas e parecem
  nuvens. Acima de 65° de latitude mostra aviso de sem cobertura.
- `.container` usa `padding-inline` (não `padding`), senão zera o espaço vertical do `<main>`.
- A linha superior do cabeçalho tem `z-index` para as sugestões da busca abrirem por cima das abas.

## Deploy

- Render, plano gratuito, configurado por `render.yaml` e `.python-version` (Python 3.12.3).
- Start command: `gunicorn web:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60`.
- Deploy automático a cada push no branch `main`.

## Como trabalhar neste projeto

- **Código sem comentários nem docstrings** (foram removidos de propósito).
- Nomes de variáveis, funções e mensagens em português, seguindo o padrão existente.
- Explicações em português, simples e passo a passo.
- Mensagens de commit em português. Fazer commit e push só quando pedido.
- Depois de mudar o visual, conferir no Chrome headless (claro, escuro e celular) e,
  se pedido, atualizar os prints em `docs/`.

# CLAUDE.md

App de clima em Python com dados da Open-Meteo (gratuita, sem chave). Tem duas interfaces:
um app de terminal e um painel web chamado **Weather**, um site estático publicado no GitHub Pages.
Repositório: https://github.com/GabrielFaria7/weather (branch principal `main`).

## Comandos

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt
python main.py                                 # app do terminal
python web.py                                  # painel web em http://127.0.0.1:5000
python3 -m http.server -d site 8000            # o painel também roda em qualquer servidor de arquivos
pytest                                         # testes Python (pytest.ini já ajusta o pythonpath)
node --test "tests/js/*.test.mjs"              # testes JavaScript (Node 22+, sem dependências)
```

- `requirements.txt` tem só o que o servidor precisa (o Render instala ele). Ferramentas de desenvolvimento
  (pytest) ficam em `requirements-dev.txt`, que inclui o `requirements.txt`.

## Arquitetura

- **Terminal:** `main.py` → `api.py` (`buscar_cidade`, `buscar_clima`, via `requests`) → `interface.py`.
- **Web (site estático em `site/`):** o **navegador** consulta a Open-Meteo direto (`site/js/servico.js`:
  geocodificação, previsão de 10 dias e qualidade do ar) e monta o painel ali mesmo (`site/js/painel.js`,
  `avisos.js`, `descricoes.js`, portados do antigo `painel.py`/`avisos.py`). O front desenha tudo com módulos ES
  em `site/js/componentes/` (um arquivo por seção da tela). Não existe mais `POST /api/painel`.
- **Caminhos relativos:** o GitHub Pages serve o site em `/weather/`, então `site/index.html` usa caminhos relativos
  (`css/app.css`, `js/main.js`, logo com `href="./"`). Nunca usar caminhos que começam com `/`.
- `web.py` é só um Flask que entrega `site/` (para o Render e para rodar localmente). `descricoes.py` continua em
  Python porque o app do terminal usa; a tabela de descrições existe nas duas linguagens.
- **Sem build no front:** HTML/CSS/JS puros. Chart.js e Leaflet vêm de CDN em `site/index.html`.
  Node só é usado para rodar os testes (`node --test`, sem `package.json` nem dependências); não migrar para
  React/Vite sem pedido explícito.

## Decisões importantes (não desfazer)

- **Nenhum servidor consulta a Open-Meteo na versão web.** No Render gratuito, o IP de saída
  é compartilhado com outros sites e a Open-Meteo respondia `429 Daily API request limit exceeded`.
  Por isso o navegador de cada visitante faz as consultas (a Open-Meteo libera CORS).
- **Alertas são automáticos, não oficiais.** `site/js/avisos.js` calcula a partir da previsão e a interface
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

- **GitHub Pages (principal):** https://gabrielfaria7.github.io/weather/ (no topo do README). O workflow
  `.github/workflows/testes.yml` roda pytest e `node --test`; se passarem, o job `publicar` envia `site/` ao Pages
  (Settings → Pages → Source: GitHub Actions).
- **Render (cópia antiga):** https://weather-jdpm.onrender.com/, plano gratuito, `render.yaml` + `.python-version`
  (Python 3.12.3). Start command: `gunicorn web:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60`. Publica depois
  que o GitHub Actions passa (`autoDeployTrigger: checksPass`). Dorme sem acessos (~1 min para acordar).

## Como trabalhar neste projeto

- **Código sem comentários nem docstrings** (foram removidos de propósito).
- Nomes de variáveis, funções e mensagens em português, seguindo o padrão existente.
- Explicações em português, simples e passo a passo.
- Mensagens de commit em português. Fazer commit e push só quando pedido.
- Depois de mudar o visual, conferir no Chrome headless (claro, escuro e celular) e,
  se pedido, atualizar os prints em `docs/`.

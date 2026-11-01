# CLAUDE.md

App de clima em Python com dados da Open-Meteo (gratuita, sem chave). Tem duas interfaces:
um app de terminal e um painel web chamado **Weather**, um site estático publicado no GitHub Pages.
Repositório: https://github.com/GabrielFaria7/weather (branch principal `main`).

## Comandos

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt
python main.py                                 # app do terminal
python3 -m http.server -d site 8000            # painel web em http://127.0.0.1:8000
pytest                                         # testes Python (pytest.ini já ajusta o pythonpath)
node --test "tests/js/*.test.mjs"              # testes JavaScript (Node 22+, sem dependências)
```

- `requirements.txt` tem só o que o app do terminal precisa (requests). Ferramentas de desenvolvimento
  (pytest) ficam em `requirements-dev.txt`, que inclui o `requirements.txt`.

## Arquitetura

- **Terminal:** `main.py` → `api.py` (`buscar_cidade`, `buscar_clima`, via `requests`) → `interface.py`.
  Fica como está: por decisão do dono do projeto, o app do terminal não recebe novas funções (as pessoas usam a
  interface web). Só corrigir se quebrar.
- **Web (site estático em `site/`):** o **navegador** consulta a Open-Meteo direto (`site/js/servico.js`:
  geocodificação, previsão de 10 dias e qualidade do ar) e monta o painel ali mesmo (`site/js/painel.js`,
  `avisos.js`, `descricoes.js`, portados do antigo `painel.py`/`avisos.py`). O front desenha tudo com módulos ES
  em `site/js/componentes/` (um arquivo por seção da tela). Não existe mais `POST /api/painel`.
- **Caminhos relativos:** o GitHub Pages serve o site em `/weather/`, então `site/index.html` usa caminhos relativos
  (`css/app.css`, `js/main.js`, logo com `href="./"`). Nunca usar caminhos que começam com `/`.
- Não há servidor próprio: o Python é só o app do terminal. `descricoes.py` continua em Python porque o terminal
  usa; a tabela de descrições existe nas duas linguagens.
- **Lógica pura fora dos componentes:** o que não depende de Leaflet nem do DOM fica em módulos próprios
  (`painel.js`, `avisos.js`, `satelites.js`, `gradeVento.js`, `formato.js`, `preferencias.js`, `servico.js`) e tem
  teste em `tests/js/` (`node:test`; `fetch` e `localStorage` são simulados nos testes). Ao criar lógica nova,
  seguir esse padrão e escrever o teste junto.
- **Sem build no front:** HTML/CSS/JS puros. Chart.js e Leaflet vêm de CDN em `site/index.html`.
  Node só é usado para rodar os testes (`node --test`, sem `package.json` nem dependências); não migrar para
  React/Vite sem pedido explícito.

## Decisões importantes (não desfazer)

- **Nenhum servidor consulta a Open-Meteo na versão web.** Quando o painel rodava no Render gratuito, o IP de
  saída era compartilhado com outros sites e a Open-Meteo respondia `429 Daily API request limit exceeded`.
  Por isso o navegador de cada visitante faz as consultas (a Open-Meteo libera CORS). Não voltar a ter servidor.
- **Alertas são automáticos, não oficiais.** `site/js/avisos.js` calcula a partir da previsão e a interface
  deixa isso claro, com link para o INMET. Nunca apresentar como alerta oficial.
- **O mapa tem só as camadas Nuvens e Vento**, ambas com dados reais. Radar de chuva, Temperatura e Precipitação
  já foram integradas (RainViewer e grade da Open-Meteo) e removidas a pedido, porque o resultado não agradou.
  Não recolocar sem pedido. Nunca simular dados no mapa.
- **Vento animado:** `buscarVentoGrade` (`servico.js`) pede à Open-Meteo, pelo navegador, uma grade de
  13 × 13 pontos (±3°, passo 0,5°) para as próximas 24 h, só quando o usuário liga a camada (cache de 30 min).
  `quadroVento` (`gradeVento.js`) converte velocidade/direção em u/v e `mapa.js` desenha com `leaflet-velocity@1.9.2` (última versão MIT;
  a 2.x mudou de licença). A interface diz que é previsão do modelo, não medição em tempo real.
- **Nuvens animadas:** imagens reais de satélite, todas grátis, sem chave e com CORS. `SATELITES` e `satelitePara`
  (`satelites.js`) escolhem a fonte pela longitude da cidade: GOES-West e GOES-East GeoColor pela NASA GIBS (WMTS, 12 quadros a cada 10 min,
  ~1 h de atraso); Meteosat MTG infravermelho `mtg_fd:ir105_hrfi` na Europa/África/Oriente Médio (−15° a 60°) e o
  mosaico global infravermelho `mumi:worldcloudmap_ir108` na Ásia/Oceania (60° a 180°, 8 quadros a cada 3 h), ambos
  pelo WMS da EUMETSAT (`view.eumetsat.int/geoserver`). `buscarHorariosSatelite` (`servico.js`) lê os horários
  (DescribeDomains na GIBS, GetCapabilities da camada na EUMETSAT) e `ultimosHorarios` pega só os últimos.
  `urlTileSatelite` devolve uma função que monta a URL de cada tile (na EUMETSAT, calcula o bbox em EPSG:3857).
  `mapa.js` cria uma `L.gridLayer` por horário num painel próprio (`nuvens`, fora do `.leaflet-tile-pane`, que
  recebe o filtro de escurecer o mapa); `deixarSoNuvens` (`satelites.js`) transforma o brilho de cada pixel em
  transparência (limites por satélite em `brilho`), para sobrar só as nuvens. Pixels de tom quente (luzes das cidades à noite no GeoColor, deserto de dia)
  são descartados. No MTG não usar `rgb_geocolour`: à noite as luzes das cidades grandes ficam brancas e parecem
  nuvens. Acima de 65° de latitude mostra aviso de sem cobertura.
- **Segurança (`site/index.html`):** os scripts e o CSS de CDN têm `integrity` (SRI, sha384) + `crossorigin`, com
  versão exata na URL; a `<meta http-equiv="Content-Security-Policy">` só libera os domínios usados (scripts:
  cdnjs e unpkg; conexões: Open-Meteo, NASA GIBS e EUMETSAT; imagens: tiles do OpenStreetMap, GIBS e EUMETSAT).
  O único script inline (o do tema, no `<head>`) é liberado pelo hash sha256 dele. `tests/js/seguranca.test.mjs`
  confere tudo isso: ao editar o script do tema, o teste falha e mostra o hash novo para pôr na CSP; ao trocar a
  versão de uma biblioteca, recalcular o `integrity` (`curl -sL URL | openssl dgst -sha384 -binary | openssl base64 -A`)
  e conferir com o hash oficial; ao usar um domínio novo, incluí-lo na diretiva certa da CSP. Estilos inline
  (`style="..."`) são usados pelo código, por isso `style-src` tem `'unsafe-inline'`. O GitHub Pages não permite
  cabeçalhos HTTP próprios, então a CSP fica na meta tag (sem `frame-ancestors`, que só vale por cabeçalho).
- **Ícones e prévia do link:** `site/favicon.svg` (mesmo desenho do logo do cabeçalho), `favicon-32.png` e
  `apple-touch-icon.png` (180 px, sem cantos arredondados, que o iOS arredonda sozinho). A prévia ao compartilhar o
  link usa as tags Open Graph do `<head>` e `site/og-image.png` (1200 × 630), gerada no Chrome headless a partir de
  `ferramentas/og-image.html` (abrir em 1200 × 630 e tirar o print da página). `og:image` e `og:url` precisam ser
  endereços completos. `tests/js/metadados.test.mjs` confere arquivos, tamanhos e tags.
- **Aplicativo (PWA):** `site/manifest.webmanifest` (caminhos relativos; ícones `icone-192.png`, `icone-512.png` e
  `icone-mascaravel-512.png`, este com o desenho dentro da área segura do Android) e `site/sw.js`, registrado em
  `main.js` (`iniciarAplicativo`, que também mostra "Instalar como aplicativo" nas configurações quando o navegador
  oferece). O service worker guarda na instalação `ARQUIVOS_DO_SITE` e as `BIBLIOTECAS` de CDN; arquivos do site vêm
  da rede primeiro (cache só se a rede falhar ou demorar 5 s), bibliotecas de CDN vêm do cache primeiro; APIs,
  satélites e tiles do mapa passam direto (não são guardados). **Ao criar ou remover arquivo em `site/`, ou trocar a
  versão de uma biblioteca de CDN, atualizar as listas do `sw.js`** (`tests/js/aplicativo.test.mjs` falha se faltar).
  `VERSAO` só precisa mudar se a forma de guardar mudar.
- **Previsão offline:** `buscarPrevisao` (`servico.js`) guarda cada previsão que deu certo em `previsoesSalvas`
  (`preferencias.js`, localStorage, até 5 cidades). Se a consulta falhar (sem internet, limite 429 etc.) e houver
  previsão salva da cidade com menos de 7 dias, devolve o painel com `salvaEm`; `main.js` mostra o aviso
  `.aviso-salvo` com a data e "Tentar de novo", e recarrega sozinho no evento `online`.
- **Emendas no mapa:** `.mapa-leaflet .leaflet-tile { outline: 1px solid transparent; }` (`app.css`) evita um fio
  claro entre os tiles do mapa em telas com escala fracionária (celulares com 2x/2,625x e notebooks a 150%), com ou
  sem camada ligada. Não remover. Testado: aumentar o tile para 257 px ou trocar o fundo não resolvem.
- `.container` usa `padding-inline` (não `padding`), senão zera o espaço vertical do `<main>`.
- A linha superior do cabeçalho tem `z-index` para as sugestões da busca abrirem por cima das abas.

## Deploy

- **GitHub Pages:** https://gabrielfaria7.github.io/weather/ (no topo do README). O workflow
  `.github/workflows/testes.yml` roda pytest e `node --test`; se passarem, o job `publicar` envia `site/` ao Pages
  (Settings → Pages → Source: GitHub Actions).
- **Dependabot** (`.github/dependabot.yml`): toda segunda-feira, às 9h de Brasília, abre no máximo um pull request
  por grupo (pip e GitHub Actions) com as versões novas. O workflow de testes roda no PR; se passar, é só fazer o
  merge. As bibliotecas de CDN em `site/index.html` (Chart.js, Leaflet, leaflet-velocity) o Dependabot não vê:
  atualizar à mão, recalculando o `integrity` (ver Segurança). leaflet-velocity fica na 1.9.2 (a 2.x mudou de licença).
- O Render (https://weather-jdpm.onrender.com/) foi desligado; `web.py` e `render.yaml` foram removidos.

## Como trabalhar neste projeto

- **Código sem comentários nem docstrings** (foram removidos de propósito).
- Nomes de variáveis, funções e mensagens em português, seguindo o padrão existente.
- Explicações em português, simples e passo a passo.
- Mensagens de commit em português. Fazer commit e push só quando pedido.
- Depois de mudar o visual, conferir no Chrome headless (claro, escuro e celular) e,
  se pedido, atualizar os prints em `docs/`.

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
  geocodificação, previsão de 10 dias, qualidade do ar e mar) e monta o painel ali mesmo (`site/js/painel.js`,
  `avisos.js`, `descricoes.js`, portados do antigo `painel.py`/`avisos.py`). O front desenha tudo com módulos ES
  em `site/js/componentes/` (um arquivo por seção da tela). Não existe mais `POST /api/painel`.
- **Caminhos relativos:** o GitHub Pages serve o site em `/weather/`, então `site/index.html` usa caminhos relativos
  (`css/app.css`, `js/main.js`, logo com `href="./"`). Nunca usar caminhos que começam com `/`.
- Não há servidor próprio: o Python é só o app do terminal. `descricoes.py` continua em Python porque o terminal
  usa; a tabela de descrições existe nas duas linguagens.
- **Lógica pura fora dos componentes:** o que não depende de Leaflet nem do DOM fica em módulos próprios
  (`painel.js`, `avisos.js`, `atualizacao.js`, `compartilhar.js`, `iqar.js`, `lua.js`, `rotulosMapa.js`, `seriesPorHora.js`, `alertasOficiais.js`, `satelites.js`, `gradeVento.js`, `temperaturaMapa.js`, `resumo.js`, `formato.js`, `preferencias.js`, `servico.js`) e tem
  teste em `tests/js/` (`node:test`; `fetch` e `localStorage` são simulados nos testes). Ao criar lógica nova,
  seguir esse padrão e escrever o teste junto.
- **Sem build no front:** HTML/CSS/JS puros. Chart.js, Leaflet e leaflet-velocity vêm de CDN, carregados sob demanda
  por `site/js/bibliotecas.js` (ver "Abrir rápido").
  Node só é usado para rodar os testes (`node --test`, sem `package.json` nem dependências); não migrar para
  React/Vite sem pedido explícito.

## Decisões importantes (não desfazer)

- **Nenhum servidor consulta a Open-Meteo na versão web.** Quando o painel rodava no Render gratuito, o IP de
  saída era compartilhado com outros sites e a Open-Meteo respondia `429 Daily API request limit exceeded`.
  Por isso o navegador de cada visitante faz as consultas (a Open-Meteo libera CORS). Não voltar a ter servidor.
- **Dois tipos de alerta, sempre separados na tela.** Os **oficiais** vêm do INMET; os **automáticos**
  (`site/js/avisos.js`) são calculados a partir da previsão e nunca podem ser apresentados como oficiais.
- **Alertas oficiais do INMET:** `buscarAlertasOficiais` (`servico.js`) só consulta para lugares dentro do Brasil
  (`noBrasil`) a API `https://apiprevmet3.inmet.gov.br/avisos/ativos` (pelo navegador; ela libera CORS para o site).
  O firewall do INMET derruba quem não é navegador e quem acessa de fora do Brasil (curl, servidores, este ambiente
  na nuvem), então não dá para testar a API daqui: os testes usam a cópia real `tests/js/dados/inmet-avisos-2026-11-01.json`
  (sem os ícones). `alertasOficiaisPara` (`alertasOficiais.js`) inclui o alerta se a cidade estiver na lista oficial
  de municípios (nome + estado convertido em UF) **ou** dentro do polígono do alerta (cobre "Usar minha localização");
  ignora encerrados e terminados, fica só com a última `id_sequencia` de cada aviso e ordena: em vigor, mais grave
  (6 Perigo Potencial = amarelo, 7 Perigo = laranja, 8 Grande Perigo = vermelho), mais próximo. Horários do INMET
  são de Brasília (UTC−3). No painel, `alertas_oficiais` é `undefined` fora do Brasil (sem seção), `null` se a
  consulta falhou (mensagem) ou a lista; enquanto o INMET não responde (`pendente`), o card mostra "Consultando os
  alertas oficiais do INMET…". O card mostra os 2 primeiros e o resto em "Mais N alertas oficiais".
  A resposta do INMET (grande, com todos os avisos do país) fica guardada por 5 min (`respostaDoInmet`), e
  `buscarAlertasDosLugares` usa essa mesma resposta para vários lugares; só falhas não são guardadas.
- **Alertas nos favoritos:** `favoritos.js` pede os alertas de todas as favoritas de uma vez
  (`buscarAlertasDosLugares`, a mesma consulta do painel) e mostra embaixo do nome um selo com a cor do nível
  (`.favorito-alerta.nivel-*`), o título, quando (`em vigor`, `a partir das HH:MM`, `a partir de amanhã` ou da data,
  em horário de Brasília) e `+N` se houver mais (`seloDosAlertas` em `alertasOficiais.js`: o primeiro da lista já
  ordenada). Fora do Brasil ou se a consulta falhar, não há selo. No desktop os favoritos podem ocupar até 55% da
  coluna lateral, para 4 cidades com selo caberem sem rolar.
- **Qualidade do ar com dois índices:** o painel mostra por padrão o **IQAr brasileiro** e permite trocar para o
  **EAQI europeu** nas configurações (`preferencias.indiceAr`: `"iqar"` | `"eaqi"`). `iqar.js` segue a Orientação
  Técnica do MMA de jan/2025 (Resolução CONAMA 506/2024): faixas do Quadro 1 (`POLUENTES_IQAR`), Equação 1 com
  `Cini` = limite anterior + 1 (ou + 0,1 no CO), arredondamento ",5 vai para o par" (`arredondarPar`) e o maior
  índice entre os poluentes. As médias exigidas (24 h para MP10, MP2,5 e SO₂; 8 h para O₃ e CO; 1 h para NO₂)
  são calculadas das horas da Open-Meteo (`past_days: 1`), exigindo 75% das horas da janela; o CO vem em µg/m³ e
  é convertido para ppm (÷ 1145,6). São estimativas do modelo CAMS, não medição de estação, e o card diz isso.
  No modo IQAr, o card mostra as médias usadas no cálculo (não o valor da hora), senão o número parece não bater
  com a faixa. Testes com o exemplo oficial do MMA e uma resposta real de São Paulo
  (`tests/js/dados/open-meteo-ar-sao-paulo-2026-11-01.json`). Previsões salvas no formato antigo (só `current`)
  continuam funcionando, sem IQAr.
- **Previsão por hora com três abas** (Temperatura, Chuva, Vento): `seriesPorHora` e `dicaPorHora`
  (`seriesPorHora.js`) preparam os dados de cada gráfico e o texto da dica; `porHora.js` troca o gráfico do Chart.js
  sem redesenhar a lista e marca a aba em `#por-hora[data-variavel]`, que o CSS usa para mostrar as linhas certas de
  cada hora (`.so-temperatura`, `.so-chuva`, `.so-vento`). Chuva: barras de mm por hora (eixo mínimo de 2 mm, para
  garoa não parecer temporal) + linha tracejada da chance. Vento: velocidade + rajadas tracejadas, seta da direção na
  lista. Dados por hora pedidos na previsão: `precipitation`, `wind_gusts_10m`, `wind_direction_10m`; previsões
  salvas antes disso mostram "—".
- **Favoritos com o tempo de agora:** `buscarClimaAtual` (`servico.js`) busca temperatura, código do tempo e dia/noite
  de várias cidades numa consulta só à Open-Meteo (coordenadas separadas por vírgula; com uma cidade a API devolve
  objeto, não lista) e guarda cada cidade por 10 minutos (chave: coordenadas com 2 casas), buscando só as que
  faltam. A cidade aberta no painel usa `estado.dados.atual` (mesmo número do card principal). `favoritos.js` desenha
  a lista na hora, com `.favorito-clima.carregando`, e preenche quando a resposta chega (ignora respostas de
  desenhos antigos). Se a consulta falhar, o espaço fica vazio, sem erro.
- **O mapa tem as camadas Temperatura, Nuvens e Vento**, todas com dados reais. Radar de chuva e Precipitação já
  foram integradas (RainViewer e grade da Open-Meteo) e removidas a pedido, porque o resultado não agradou; não
  recolocar sem pedido. A primeira versão da Temperatura também foi removida por ficar "opaca e sem cores vivas";
  a atual foi feita a pedido, no estilo do mapa de calor da Meteored. Nunca simular dados no mapa.
- **Grade do mapa:** `buscarGradeMapa(centro, { passo })` (`servico.js`) pede à Open-Meteo, pelo navegador, uma grade
  de 13 × 13 pontos (6 passos para cada lado; passo padrão 0,5°, ou seja ±3°) com vento e temperatura das próximas
  24 h e a altitude de cada ponto (`elevation`), só quando o usuário liga Temperatura ou Vento. A grade da cidade serve
  às duas camadas (cache de 30 min); o Vento fica sempre nela.
- **Temperatura acompanha o mapa:** a camada usa a própria grade (`gradeTemperatura` em `mapa.js`). No `moveend`
  (esperando 500 ms parado), `precisaDeNovaGrade` (`temperaturaMapa.js`) vê se a vista saiu da grade ou mudou de faixa
  de zoom (`passoParaZoom`: 0,5° do zoom 8 para cima, 1° no 7, 2° no 6 e 4° abaixo disso; vista maior que a grade só
  troca se o centro andar mais de 1/4 dela). Antes de consultar, reaproveita a grade da cidade ou uma das últimas 12
  guardadas (`gradeQueServe`, 30 min); senão busca a grade nova centrada na vista, encaixada no passo
  (`centroParaNovaGrade`), cancelando a anterior. Ao trocar de grade, `indiceDoMesmoHorario` mantém o horário do
  controle de tempo. Cada grade nova custa 169 pontos na cota da Open-Meteo, por isso o cache e a espera.
- **Nomes e temperaturas no mapa (como a Meteored):** com a Temperatura ligada, `mapa.js` mostra até 24 rótulos
  "Cidade 17°" num painel próprio (`rotulos`, z-index 450, sem receber o mouse). As cidades vêm do GeoNames
  (`cities15000`, CC BY 4.0, crédito "Cidades: GeoNames" no mapa), convertidas por `ferramentas/gerar_cidades.py` em
  blocos de 10° × 10° em `site/dados/cidades/` (`indice.json` + `<lat>_<lon>.json`, cada cidade como
  `[nome, lat, lon, população em mil, altitude]`, das maiores para as menores). `buscarCidadesDaArea` (`servico.js`)
  lê o índice e só os blocos da vista, guardando na memória (por isso a CSP tem `connect-src 'self'`). Esses arquivos
  não entram em `ARQUIVOS_DO_SITE` (o service worker guarda só os usados). `escolherRotulos` (`rotulosMapa.js`) põe
  primeiro as maiores e pula os que encostam em outro rótulo, no marcador da cidade ou nos controles do mapa (zoom,
  legenda, créditos). O rótulo fica centrado no ponto da cidade, cobrindo o nome que já vem no mapa base (senão o
  nome aparece duas vezes). A cidade aberta tem rótulo azul acima do marcador, ou abaixo se acima não couber
  (`grupo`). A temperatura do rótulo usa a altitude do GeoNames. Para atualizar a lista: baixar
  `https://download.geonames.org/export/dump/cities15000.zip`, extrair e rodar
  `python3 ferramentas/gerar_cidades.py cities15000.txt` (`tests/test_gerar_cidades.py` testa o conversor).
- **Vento animado:**
  `quadroVento` (`gradeVento.js`) converte velocidade/direção em u/v e `mapa.js` desenha com `leaflet-velocity@1.9.2` (última versão MIT;
  a 2.x mudou de licença). A interface diz que é previsão do modelo, não medição em tempo real.
- **Temperatura (mapa de calor):** `temperaturaMapa.js` leva a temperatura de cada ponto da grade ao nível do mar
  (+0,65 °C a cada 100 m de `elevation`), interpola entre os pontos e devolve à altitude real de cada pixel, lida do
  relevo AWS Terrain Tiles (formato terrarium, `s3.amazonaws.com/elevation-tiles-prod`, grátis, sem chave, com CORS,
  até o zoom 12). É isso que faz serras e vales aparecerem. O mesmo relevo dá o sombreamento (luz do noroeste,
  `sombreamento`). Cores vivas da escala `ESCALA_TEMPERATURA_MAPA` (roxo → azul → ciano → verde → amarelo → laranja →
  vermelho → vinho), com tabela pré-calculada para trocar de hora rápido. `mapa.js` desenha uma `L.gridLayer` num painel
  próprio (`temperatura`) com `mix-blend-mode: multiply` sobre o mapa base cinza claro (`.com-temperatura`, nos dois
  temas), para os nomes das cidades e estradas aparecerem por cima das cores. Os canvas da camada têm 257 px
  (`.camada-temperatura canvas`): sem isso aparece um fio entre os tiles em telas com escala fracionária. Ao apontar
  no mapa, a legenda mostra a temperatura e a altitude do ponto. As bordas da grade se apagam aos poucos.
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
- **Segurança (`site/index.html`):** os scripts e o CSS de CDN ficam em `BIBLIOTECAS` (`site/js/bibliotecas.js`) com
  `integrity` (SRI, sha384) e versão exata na URL; `carregarBiblioteca` cria o `<script>`/`<link>` com `integrity` e
  `crossOrigin = "anonymous"` (o CSS do Leaflet entra antes do `app.css`, para o nosso CSS continuar valendo). A fonte
  Inter é do próprio site (`font-src 'self'`, sem Google Fonts); a `<meta http-equiv="Content-Security-Policy">` só libera os domínios usados (scripts:
  cdnjs e unpkg; conexões: o próprio site (blocos de cidades), Open-Meteo, INMET, NASA GIBS e EUMETSAT; imagens: tiles do OpenStreetMap, GIBS, EUMETSAT e o relevo em `s3.amazonaws.com/elevation-tiles-prod/`).
  O único script inline (o do tema, no `<head>`) é liberado pelo hash sha256 dele. `tests/js/seguranca.test.mjs`
  confere tudo isso (lendo `BIBLIOTECAS`): ao editar o script do tema, o teste falha e mostra o hash novo para pôr na
  CSP; ao trocar a versão de uma biblioteca (em `bibliotecas.js` e na lista `BIBLIOTECAS` do `sw.js`), recalcular o `integrity` (`curl -sL URL | openssl dgst -sha384 -binary | openssl base64 -A`)
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
  oferece). O service worker guarda na instalação `ARQUIVOS_DO_SITE` (inclui `fontes/inter-latin.woff2`) e as
  `BIBLIOTECAS` de CDN (iguais às de `bibliotecas.js`, o teste confere); arquivos do site vêm
  da rede primeiro (cache só se a rede falhar ou demorar 5 s), bibliotecas de CDN vêm do cache primeiro; APIs,
  satélites e tiles do mapa passam direto (não são guardados). **Ao criar ou remover arquivo em `site/`, ou trocar a
  versão de uma biblioteca de CDN, atualizar as listas do `sw.js`** (`tests/js/aplicativo.test.mjs` falha se faltar).
  `VERSAO` só precisa mudar se a forma de guardar mudar.
- **Resumo do dia:** `resumoDoDia` (`resumo.js`) escreve uma frase sobre as próximas 12 horas, mostrada no card
  principal em "Próximas horas": chuva (começa, para, o tempo todo, com trovoadas, pouca chance ou sem chuva; conta
  como chuva a hora com chance ≥ 50% e ≥ 0,1 mm), temperatura (máxima de hoje, se ainda vai esquentar, ou "caindo até"
  a mínima das próximas horas) e rajadas ≥ 50 km/h. Respeita °C/°F, unidade de vento e relógio de 12/24 h, com
  "da 01:00" e "da meia-noite" no singular. Previsões salvas sem mm/rajadas por hora usam só a chance.
- **Ontem × hoje:** a previsão pede `past_days: 1`, então `daily` e `hourly` começam no dia anterior.
  `montarPainel` separa esse dia em `ontem` (`{ data, max, min }`) e deixa em `dias` só de hoje em diante (os
  "Próximos 10 dias", o Máx/Mín do card e os alertas automáticos não podem ver o dia de ontem). O card principal
  mostra `comparacaoComOntem` (`resumo.js`): "Hoje está 3° mais quente/frio que ontem" ou "parecida", comparando as
  máximas **já arredondadas** na unidade escolhida (senão a frase não bate com os números da tela). Previsões salvas
  sem o dia anterior ficam sem a frase.
- **Compartilhar:** botão ao lado da estrela no card principal. `conteudoParaCompartilhar` (`compartilhar.js`) monta
  título, texto (tempo de agora, máx/mín e o resumo das próximas horas) e o link da cidade; `main.js` usa o menu do
  sistema (`navigator.share`) e, se não houver, copia texto + link (`navigator.clipboard`) com aviso. Privacidade: para
  "Sua localização" (GPS), o link vai com as coordenadas arredondadas para 2 casas (~1 km) e o nome "Local
  compartilhado", nunca a posição exata.
- **Lua:** `lua.js` calcula tudo no navegador, sem API: posição da Lua e do Sol pelas séries de baixa precisão de
  Meeus (Astronomical Algorithms, cap. 47, os 18 primeiros termos da longitude), fase (`faseDaLua`: fração do ciclo,
  % iluminada, nome em português, crescendo ou não), nascer/pôr do dia local (`nascerEPorDaLua`: borda de cima no
  horizonte com refração de 34′ e paralaxe, amostrando a cada 10 min e refinando; trata "não nasce hoje", "não se
  põe hoje" e lua o dia todo acima/abaixo perto dos polos) e próximas lua cheia e nova (`proximaFase`). O Sol usa a
  longitude média **do equinócio da data** (280,46646 + 0,98564736·d): com a do periélio fixo de J2000 as fases saíam
  ~45 min adiantadas. Conferido com o PyEphem: fases a menos de 10 min, nascer/pôr a menos de 5 min, iluminação a
  0,5% (`tests/js/lua.test.mjs`). `desenhoDaLua` monta o caminho SVG da parte iluminada, espelhado no hemisfério sul.
  O painel guarda `deslocamento` (`utc_offset_seconds`) para achar a meia-noite local.
- **Mar:** `buscarPrevisao` consulta junto a Open-Meteo Marine (`marine-api.open-meteo.com`: altura, direção e período
  das ondas, temperatura da água e máxima de ondas de hoje e amanhã); se falhar, `mar` fica `null` sem atrapalhar a
  previsão. Cidades longe do mar recebem tudo `null`, e `montarMar` devolve `null`: o card "Mar" (`componentes/mar.js`)
  só aparece no litoral. `classificarMar` dá o estado pela altura (faixas da escala Douglas: calmo < 0,5 m, pouco
  agitado < 1,25, agitado < 2,5, muito agitado < 4, grosso < 6, muito grosso). O card diz que é estimativa de modelo,
  não medição de boia. Previsões salvas (offline) ficam sem mar.
- **Lua e Mar na tela:** última linha do painel. No litoral os dois cards dividem a linha (`.painel.com-mar`, 6 + 6
  colunas); no interior a Lua ocupa a linha inteira e organiza os dados na horizontal (container query em
  `.area-lua`/`.area-mar`, a partir de 760 px de largura do card). No celular empilham.
- **Atualização automática:** com o painel aberto e a aba visível, `main.js` busca a previsão de novo a cada 15 min
  (`deveAtualizar` e `INTERVALO_ATUALIZACAO_MS` em `atualizacao.js`; confere a cada 30 s e no `visibilitychange`, então
  quem volta ao app depois de horas recebe dados novos na hora). Não atualiza sem internet nem com a janela de um dia
  (`#modal-dia`) aberta. A atualização é silenciosa: usa `renderizarConteudo` (não recria o mapa, então a camada ligada
  continua) e guarda a rolagem da lista de horas. Se a busca cair na previsão salva (`salvaEm`), mantém o que está na
  tela. O card principal mostra "Atualizado há X min" (`textoAtualizacao`), que também é um botão para atualizar na
  hora; se falhar pelo botão, aparece um aviso.
- **Abrir rápido (Lighthouse no celular: 72 → 98, saltos de layout 0):** nada de CDN trava a primeira pintura.
  `carregarBiblioteca` (`bibliotecas.js`, uma vez por biblioteca, com nova tentativa se falhar): Chart.js quando o
  gráfico por hora chega a 300 px da tela (`IntersectionObserver` em `porHora.js`) ou ao abrir a janela de um dia;
  Leaflet (CSS + JS) quando o mapa chega a 400 px da tela ou ao tocar numa camada (`garantirMapa` em `mapa.js`);
  leaflet-velocity só ao ligar o Vento. A fonte Inter fica em `site/fontes/` (variável, `latin` com `preload` e
  `latin-ext` só se aparecer letra dela; licença SIL OFL em `LICENCA-INTER.txt`, que precisa ir junto). O painel abre em
  duas etapas: `buscarPrevisao` só exige a previsão; qualidade do ar, mar e INMET (o INMET manda ~280 KB sem compressão
  e costuma levar ~2 s) esperam no máximo 400 ms (`ESPERA_COMPLEMENTOS_MS`). Se não chegarem, o painel vem com
  `pendente: true` e a promessa `complementos`; os cards mostram "Consultando…" e `esperarComplementos` (`main.js`)
  redesenha só alertas, indicadores, qualidade do ar e mar (`renderizarComplementos`) quando eles chegam.
  `html { scrollbar-gutter: stable }` e `main { min-height: 100vh }` evitam os saltos da barra de rolagem e do rodapé.
- **Acessibilidade (Lighthouse 100, axe sem problemas nos dois temas):** contraste mínimo de 4,5 em texto pequeno:
  `--texto-2` claro é `#57667B` (o antigo `#64748B` dava 4,34 sobre `--superficie-2`); etiquetas de nível usam
  `--cor-texto` (amarelo do INMET `--atencao-texto: #92600E` no claro) e os níveis da qualidade do ar têm `--cor-texto`
  mais escuro no claro e mais claro no escuro (o anel continua com a cor viva). Dentro de `<dl>`, cada `<div>` só pode
  ter `<dt>`/`<dd>` (o detalhe vai num segundo `<dd class="astro-detalhe">`). Para auditar: axe-core via Playwright com
  `bypassCSP` (a CSP do site bloqueia o script injetado), em claro, escuro, celular, janela do dia, configurações,
  mapa e "Consultando…".
- **Previsão offline:** `buscarPrevisao` (`servico.js`) guarda cada previsão que deu certo em `previsoesSalvas`
  (`preferencias.js`, localStorage, até 5 cidades). Se a consulta falhar (sem internet, limite 429 etc.) e houver
  previsão salva da cidade com menos de 7 dias, devolve o painel com `salvaEm`; `main.js` mostra o aviso
  `.aviso-salvo` com a data e "Tentar de novo", e recarrega sozinho no evento `online`.
- **Emendas no mapa:** `.mapa-leaflet .leaflet-tile { outline: 1px solid transparent; }` (`app.css`) evita um fio
  claro entre os tiles do mapa em telas com escala fracionária (celulares com 2x/2,625x e notebooks a 150%), com ou
  sem camada ligada. Não remover. Testado: aumentar o tile para 257 px ou trocar o fundo não resolvem.
- **Layout do topo no desktop (≥ 1025 px):** a coluna da direita (`.area-lateral`: alertas + favoritos) ocupa duas
  linhas e a Previsão por hora fica à esquerda, embaixo do card principal (`grid-row: span 2` e `.area-horas` com
  span 8). `.area-lateral` tem `contain: size`, então quem define a altura é a coluna da esquerda; os alertas rolam
  dentro do card (`.alertas-corpo`) e ganham esmaecido embaixo (`.tem-mais`, marcado em `alertas.js`) quando há mais
  conteúdo. Sem isso, muitos alertas esticavam o card principal e deixavam um buraco vazio enorme. Abaixo de
  1025 px tudo empilha como antes.
- **Lista de horas:** `.horas-trilho` usa `scroll-padding-inline` igual ao `padding` (20 px, 16 px no celular). Sem
  isso, o encaixe da rolagem (`scroll-snap`) rola a lista sozinho e o "Agora" fica colado na borda do card.
- **Bases alinhadas:** `.area-dias > *` tem `height: 100%`, para o card "Próximos 10 dias" terminar junto com os
  cards de "Informações climáticas" no desktop.
- `.container` usa `padding-inline` (não `padding`), senão zera o espaço vertical do `<main>`.
- A linha superior do cabeçalho tem `z-index` para as sugestões da busca abrirem por cima das abas.

## Deploy

- **GitHub Pages:** https://gabrielfaria7.github.io/weather/ (no topo do README). O workflow
  `.github/workflows/testes.yml` roda pytest e `node --test`; se passarem, o job `publicar` envia `site/` ao Pages
  (Settings → Pages → Source: GitHub Actions).
- **Dependabot** (`.github/dependabot.yml`): toda segunda-feira, às 9h de Brasília, abre no máximo um pull request
  por grupo (pip e GitHub Actions) com as versões novas. O workflow de testes roda no PR; se passar, é só fazer o
  merge. As bibliotecas de CDN em `site/js/bibliotecas.js` (Chart.js, Leaflet, leaflet-velocity) o Dependabot não vê:
  atualizar à mão, recalculando o `integrity` (ver Segurança). leaflet-velocity fica na 1.9.2 (a 2.x mudou de licença).
- O Render (https://weather-jdpm.onrender.com/) foi desligado; `web.py` e `render.yaml` foram removidos.

## Licença

- **Todos os direitos reservados** (`LICENSE`, desde 02/11/2026; antes era MIT). Pode ver o código e usar o site, mas
  copiar, modificar, publicar ou reutilizar exige autorização por escrito do autor. O rodapé do site mostra
  "© 2026 Gabriel Faria · Todos os direitos reservados". O repositório continua público porque, no plano gratuito do
  GitHub, deixar privado tira o site do Pages do ar.

## Como trabalhar neste projeto

- **Código sem comentários nem docstrings** (foram removidos de propósito).
- Nomes de variáveis, funções e mensagens em português, seguindo o padrão existente.
- Explicações em português, simples e passo a passo.
- Mensagens de commit em português. Fazer commit e push só quando pedido.
- Depois de mudar o visual, conferir no Chrome headless (claro, escuro e celular) e,
  se pedido, atualizar os prints em `docs/`.

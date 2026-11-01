# Weather 🌤️

Mostra o clima de qualquer cidade usando a API gratuita [Open-Meteo](https://open-meteo.com/) (sem chave).
Tem duas formas de usar: no terminal e num painel web completo.

**Acesse o painel online:** https://gabrielfaria7.github.io/weather/

> O painel é um site estático no GitHub Pages: abre na hora, sem servidor para "acordar".

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

Web (o painel é só HTML, CSS e JavaScript, na pasta `site/`, então basta um servidor de arquivos):
```bash
python3 -m http.server -d site 8000
```
Depois, abra http://127.0.0.1:8000 no navegador.

O painel web tem: clima atual, previsão por hora com gráfico de temperatura, chuva ou vento, 10 dias (clique em um dia para ver
detalhes), indicadores (UV, pressão, visibilidade, sol...), qualidade do ar (índice brasileiro IQAr ou europeu EAQI),
alertas oficiais do INMET e automáticos,
mapa com vento e nuvens animados, cidades favoritas, °C/°F, modo claro/escuro e localização atual.

> **Instale como aplicativo:** no Chrome/Edge, use o ícone de instalar na barra de endereço (ou
> **Configurações → Instalar como aplicativo** no painel); no iPhone, **Compartilhar → Adicionar à Tela de Início**.
> Sem internet, o app abre normalmente e mostra a última previsão salva de cada cidade (com aviso de quando ela é).

> **Qualidade do ar:** por padrão o painel mostra o **IQAr**, o índice oficial do Brasil (Resolução CONAMA 506/2024),
> calculado com as médias de 24 h, 8 h e 1 h que a norma exige a partir da estimativa do modelo CAMS (Open-Meteo).
> Nas configurações dá para trocar para o índice europeu (EAQI). É estimativa de modelo, não medição de estação.
>
> **Alertas:** para cidades do Brasil, o painel mostra os **alertas oficiais do INMET** (avisos ativos da área da
> cidade, com severidade, período, riscos e o que fazer). Abaixo deles ficam os alertas **automáticos**, calculados
> a partir da previsão, que **não são oficiais**.
> No **mapa**, a camada **Vento** mostra a previsão da Open-Meteo animada (não é medição em tempo real) e a
> camada **Nuvens** mostra imagens reais de satélite do mundo todo (menos perto dos polos): GOES (NOAA, via NASA GIBS)
> nas Américas e Meteosat MTG (EUMETSAT) na Europa, África e Oriente Médio, a cada 10 minutos; na Ásia e Oceania,
> o mosaico de satélites geoestacionários da EUMETSAT, a cada 3 horas.

## Publicar

O painel web é um **site estático**: a pasta `site/` tem tudo (HTML, CSS e JavaScript). O navegador de cada
visitante consulta a Open-Meteo e monta o painel sozinho, sem servidor. Assim cada pessoa usa o próprio limite
gratuito da API e o site abre na hora.

A cada `git push` no `main`, o GitHub Actions roda os testes e, se passarem, publica a pasta `site/` no
GitHub Pages, em https://gabrielfaria7.github.io/weather/ (`.github/workflows/testes.yml`).
Para ativar num repositório novo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Segurança

O painel carrega Chart.js e Leaflet de CDNs públicas. Para evitar que um arquivo adulterado na CDN rode no site,
cada um tem verificação de integridade (SRI): o navegador só executa o arquivo se ele for idêntico ao esperado.
A página também tem uma política de segurança de conteúdo (CSP) que só libera os sites que o painel realmente
usa (Open-Meteo, NASA GIBS, EUMETSAT, OpenStreetMap e as CDNs). Um teste automático confere essas proteções.

## Atualizações

O Dependabot (`.github/dependabot.yml`) confere toda segunda-feira se há versões novas das dependências Python
(`requirements.txt` e `requirements-dev.txt`) e das ações usadas no GitHub Actions. Quando há, ele abre um pull
request com tudo agrupado; os testes rodam sozinhos no pull request e, se passarem, basta fazer o merge.

As bibliotecas carregadas por CDN no `site/index.html` (Chart.js e Leaflet) são atualizadas manualmente, porque
cada troca de versão exige recalcular a verificação de integridade.

## Testes

Python (app do terminal) — as ferramentas de teste ficam em `requirements-dev.txt`:

```bash
pip install -r requirements-dev.txt
pytest
```

JavaScript (painel, alertas, consultas às APIs, previsão offline, satélites, vento, formatação, preferências, aplicativo e segurança da página) — usa o executor de testes que já vem no Node.js 22 ou mais novo:

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
| `site/index.html` | Estrutura da página (cabeçalho, abas) |
| `site/css/app.css` | Visual, temas claro/escuro e responsividade |
| `site/js/main.js` | Junta tudo: estado da página e eventos |
| `site/js/servico.js` | Consulta a Open-Meteo direto do navegador (camada de dados) |
| `site/js/painel.js` | Organiza os dados da API no formato do painel |
| `site/js/avisos.js` | Calcula os alertas automáticos (chuva, vento, calor, frio) |
| `site/js/seriesPorHora.js` | Prepara os gráficos da previsão por hora (temperatura, chuva e vento) |
| `site/js/iqar.js` | Calcula o índice brasileiro de qualidade do ar (IQAr, CONAMA 506/2024) |
| `site/js/alertasOficiais.js` | Escolhe os alertas oficiais do INMET que valem para a cidade |
| `site/js/descricoes.js` | Traduz o código do tempo para português |
| `site/js/satelites.js` | Escolhe o satélite das nuvens pela região e deixa só as nuvens visíveis na imagem |
| `site/js/gradeVento.js` | Converte a grade de vento para o formato da animação e acha o ponto sob o mouse |
| `site/js/formato.js` / `preferencias.js` | Formatação (temperatura, vento, horas) e preferências/favoritos salvos no navegador |
| `site/js/componentes/` | Uma parte da tela por arquivo (card atual, por hora, 10 dias, mapa...) |
| `site/favicon.svg`, `*.png` | Ícones do site e do aplicativo e imagem de prévia ao compartilhar o link (Open Graph) |
| `site/manifest.webmanifest` | Dados do aplicativo instalável (nome, cores, ícones) |
| `site/sw.js` | Service worker: guarda os arquivos do site para ele abrir sem internet |
| `ferramentas/og-image.html` | Modelo da imagem de prévia (abrir em 1200 × 630 e tirar o print) |
| `tests/` | Testes em Python (`pytest`) e em JavaScript (`tests/js/`, `node --test`) |

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

TAMANHO_DO_BLOCO = 10
IGNORAR = {"PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"}
DESTINO_PADRAO = Path(__file__).resolve().parent.parent / "site" / "dados" / "cidades"


def chave_do_bloco(latitude, longitude):
    base = lambda valor: int(valor // TAMANHO_DO_BLOCO * TAMANHO_DO_BLOCO)
    return f"{base(latitude)}_{base(longitude)}"


def linha_para_cidade(colunas):
    if colunas[7] in IGNORAR:
        return None
    altitude = colunas[16] if colunas[16] not in ("", "-9999") else "0"
    populacao_mil = round(int(colunas[14] or 0) / 1000)
    return [colunas[1], round(float(colunas[4]), 3), round(float(colunas[5]), 3), populacao_mil, int(altitude)]


def gerar(origem, destino=DESTINO_PADRAO):
    blocos = defaultdict(list)
    with open(origem, encoding="utf-8") as arquivo:
        for colunas in csv.reader(arquivo, delimiter="\t", quoting=csv.QUOTE_NONE):
            cidade = linha_para_cidade(colunas)
            if cidade:
                blocos[chave_do_bloco(cidade[1], cidade[2])].append(cidade)
    destino.mkdir(parents=True, exist_ok=True)
    for antigo in destino.glob("*.json"):
        antigo.unlink()
    for chave, cidades in blocos.items():
        cidades.sort(key=lambda cidade: (-cidade[3], cidade[0]))
        texto = json.dumps(cidades, ensure_ascii=False, separators=(",", ":"))
        (destino / f"{chave}.json").write_text(texto, encoding="utf-8")
    (destino / "indice.json").write_text(json.dumps(sorted(blocos), separators=(",", ":")), encoding="utf-8")
    return len(blocos), sum(len(cidades) for cidades in blocos.values())


if __name__ == "__main__":
    blocos, cidades = gerar(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else DESTINO_PADRAO)
    print(f"{blocos} blocos com {cidades} cidades")

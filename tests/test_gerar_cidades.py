import json

from ferramentas.gerar_cidades import chave_do_bloco, gerar, linha_para_cidade


def linha(nome, latitude, longitude, codigo="PPLA", populacao="1948626", altitude="935"):
    colunas = [""] * 19
    colunas[1], colunas[4], colunas[5], colunas[7] = nome, latitude, longitude, codigo
    colunas[14], colunas[16] = populacao, altitude
    return colunas


def test_chave_do_bloco_de_10_graus():
    assert chave_do_bloco(-25.43, -49.27) == "-30_-50"
    assert chave_do_bloco(38.72, -9.14) == "30_-10"
    assert chave_do_bloco(35.69, 139.69) == "30_130"
    assert chave_do_bloco(0.0, 0.0) == "0_0"


def test_linha_vira_cidade_compacta():
    assert linha_para_cidade(linha("Curitiba", "-25.42778", "-49.27306")) == ["Curitiba", -25.428, -49.273, 1949, 935]
    assert linha_para_cidade(linha("Bairro", "-25.4", "-49.2", codigo="PPLX")) is None
    assert linha_para_cidade(linha("Sem altitude", "1", "2", altitude="-9999"))[4] == 0


def test_gera_blocos_e_indice(tmp_path):
    origem = tmp_path / "cidades.txt"
    linhas = [linha("Curitiba", "-25.42778", "-49.27306"), linha("Colombo", "-25.29", "-49.22", populacao="240840"),
              linha("Lisboa", "38.71667", "-9.13333", populacao="517802", altitude="45")]
    origem.write_text("\n".join("\t".join(colunas) for colunas in linhas), encoding="utf-8")
    assert gerar(origem, tmp_path / "saida") == (2, 3)
    assert json.loads((tmp_path / "saida" / "indice.json").read_text()) == ["-30_-50", "30_-10"]
    curitiba = json.loads((tmp_path / "saida" / "-30_-50.json").read_text(encoding="utf-8"))
    assert [cidade[0] for cidade in curitiba] == ["Curitiba", "Colombo"]

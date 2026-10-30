from painel import montar_painel
from tests.dados_falsos import previsao_falsa

LOCAL = {"nome": "X", "estado": "", "pais": "", "latitude": 0, "longitude": 0}


def avisos(**kwargs):
    return montar_painel(LOCAL, previsao_falsa(**kwargs))["avisos"]


def test_dia_tranquilo_nao_gera_aviso():
    assert avisos() == []


def test_chuva_intensa_e_vento():
    lista = avisos(chuva_mm=(55.0, 0.0), rajadas=(85.0, 10.0))
    assert [(a["tipo"], a["nivel"]) for a in lista] == [("chuva", "perigo"), ("vento", "alerta")]
    assert "hoje" in lista[0]["detalhe"]


def test_tempestade_calor_e_frio():
    lista = avisos(codigos=(95, 2), maximas=(36.0, 30.0), minimas=(24.0, 2.0))
    tipos = {a["tipo"]: a["nivel"] for a in lista}
    assert tipos == {"tempestade": "alerta", "calor": "atencao", "frio": "atencao"}
    assert any("amanhã" in a["detalhe"] for a in lista)

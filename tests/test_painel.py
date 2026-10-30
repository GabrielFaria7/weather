from painel import classificar_qualidade_ar, montar_painel
from tests.dados_falsos import previsao_falsa

LOCAL = {"nome": "Manaus", "estado": "Amazonas", "pais": "Brasil", "latitude": -3.1, "longitude": -60.0}


def test_por_hora_comeca_na_hora_atual_e_tem_24_horas():
    painel = montar_painel(LOCAL, previsao_falsa())
    assert painel["por_hora"][0]["horario"] == "2026-10-29T17:00"
    assert len(painel["por_hora"]) == 24


def test_dias_trazem_descricao_e_suas_horas():
    painel = montar_painel(LOCAL, previsao_falsa())
    hoje = painel["dias"][0]
    assert hoje["descricao"] == "Chuva leve"
    assert len(hoje["horas"]) == 24
    assert all(h["horario"].startswith("2026-10-29") for h in hoje["horas"])


def test_qualidade_do_ar_ausente():
    assert montar_painel(LOCAL, previsao_falsa(), None)["qualidade_ar"] is None


def test_classificar_qualidade_ar():
    assert classificar_qualidade_ar(15) == "Boa"
    assert classificar_qualidade_ar(55) == "Moderada"
    assert classificar_qualidade_ar(150) == "Extremamente ruim"

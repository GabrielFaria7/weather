from descricoes import descrever, icone


def test_descricoes_conhecidas():
    assert descrever(0) == "Céu limpo"
    assert descrever(61) == "Chuva leve"
    assert descrever(95) == "Trovoada"


def test_codigo_desconhecido():
    assert descrever(999) == "Condição desconhecida"
    assert icone(999) == "❔"

"""Mostra o resultado no terminal. Só cuida da aparência, não busca nada."""

from descricoes import descrever, icone


def nome_completo(cidade):
    """Monta "Recife, Pernambuco - Brasil", pulando as partes que estiverem vazias."""
    local = ", ".join(parte for parte in (cidade["nome"], cidade["estado"]) if parte)
    if cidade["pais"]:
        local += f" - {cidade['pais']}"
    return local


def mostrar_clima(cidade, clima):
    codigo = clima["weather_code"]
    print()
    print(f"📍 {nome_completo(cidade)}")
    print(f"🌡️  Temperatura:      {clima['temperature_2m']:.1f} °C")
    print(f"🤔 Sensação térmica: {clima['apparent_temperature']:.1f} °C")
    print(f"💧 Umidade:          {clima['relative_humidity_2m']} %")
    print(f"💨 Vento:            {clima['wind_speed_10m']:.1f} km/h")
    print(f"{icone(codigo)}  Tempo:            {descrever(codigo)}")
    print()

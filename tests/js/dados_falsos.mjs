export function previsaoFalsa({
  chuvaMm = [2.0, 0.0], rajadas = [20.0, 15.0], maximas = [31.0, 30.0], minimas = [24.0, 23.0], codigos = [61, 2],
} = {}) {
  const datas = ["2026-10-29", "2026-10-30"];
  const horarios = datas.flatMap((d) => [...Array(24)].map((_, h) => `${d}T${String(h).padStart(2, "0")}:00`));
  return {
    timezone: "America/Manaus",
    current: {
      time: "2026-10-29T17:45", temperature_2m: 29.4, apparent_temperature: 33.1,
      relative_humidity_2m: 80, dew_point_2m: 25.0, wind_speed_10m: 7.2,
      wind_direction_10m: 90, wind_gusts_10m: 18.0, weather_code: 61, is_day: 1,
      pressure_msl: 1010.0, visibility: 12000.0, uv_index: 3.2, precipitation: 0.4,
    },
    hourly: {
      time: horarios,
      temperature_2m: horarios.map((_, i) => 25.0 + (i % 24) / 4),
      weather_code: horarios.map(() => 61),
      precipitation_probability: horarios.map(() => 40),
      wind_speed_10m: horarios.map(() => 8.0),
      is_day: horarios.map((_, i) => (i % 24 >= 6 && i % 24 < 18 ? 1 : 0)),
    },
    daily: {
      time: datas,
      weather_code: [...codigos],
      temperature_2m_max: [...maximas],
      temperature_2m_min: [...minimas],
      precipitation_probability_max: [80, 10],
      precipitation_sum: [...chuvaMm],
      wind_speed_10m_max: [12.0, 10.0],
      wind_gusts_10m_max: [...rajadas],
      uv_index_max: [9.0, 10.0],
      sunrise: ["2026-10-29T05:50", "2026-10-30T05:50"],
      sunset: ["2026-10-29T18:05", "2026-10-30T18:05"],
    },
  };
}

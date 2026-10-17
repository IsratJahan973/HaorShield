// Displays Open-Meteo model/current conditions; does not call model precipitation a rain-gauge measurement.
export function summarizeCurrentWeather(current, retrievedAt = new Date()) {
  const time = typeof current?.time === 'string' ? current.time : '';
  const stamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time) ? Date.parse(`${time}+06:00`) : NaN;
  const now = new Date(retrievedAt).getTime();
  const age = (now - stamp) / 3600000;
  const fresh = Number.isFinite(age) && age >= -1 && age <= 6;
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const temperatureC = fresh ? number(current?.temperature_2m) : null;
  const rainMm = fresh ? number(current?.precipitation) : null;
  const humidityCandidate = fresh ? number(current?.relative_humidity_2m) : null;
  const windCandidate = fresh ? number(current?.wind_speed_10m) : null;
  const humidityPct = humidityCandidate !== null && humidityCandidate >= 0 && humidityCandidate <= 100 ? humidityCandidate : null;
  const windKmh = windCandidate !== null && windCandidate >= 0 ? windCandidate : null;
  const validRain = rainMm !== null && rainMm >= 0 ? rainMm : null;
  const code = number(current?.weather_code);
  const description = !fresh || code === null ? 'Weather status unavailable' :
    code === 0 ? 'Clear sky' : [1,2,3].includes(code) ? 'Cloudy or partly cloudy' :
    [45,48].includes(code) ? 'Foggy' : [51,53,55,56,57].includes(code) ? 'Drizzle' :
    [61,63,65,66,67,80,81,82].includes(code) ? 'Rainy' :
    [71,73,75,77,85,86].includes(code) ? 'Snow' : [95,96,99].includes(code) ? 'Thunderstorm' : 'Weather status unavailable';
  return { fresh, temperatureC, rainMm: validRain, humidityPct, windKmh, description, reportedTime: fresh ? time : null };
}

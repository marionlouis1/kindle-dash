// Outside weather from Open-Meteo (free, no key).

export const PLACE = { name: "Biarritz", lat: 43.4832, lon: -1.5586, tz: "Europe/Paris" };

export type Weather = {
  now: {
    temp: number;
    feels: number;
    code: number;
    isDay: boolean;
    wind: number;
    gusts: number;
    humidity: number;
  };
  hours: { hour: string; temp: number; rain: number; code: number; isDay: boolean }[];
  days: { date: string; code: number; min: number; max: number; rain: number }[];
  sunrise: string;
  sunset: string;
};

export async function getWeather(): Promise<Weather> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${PLACE.lat}&longitude=${PLACE.lon}` +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,is_day" +
    "&hourly=temperature_2m,precipitation_probability,weather_code,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset" +
    `&timezone=${encodeURIComponent(PLACE.tz)}&forecast_days=6`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  const d = await res.json();

  // Hourly times are local ("2026-11-15T13:00"), so plain string comparison works.
  const nowHour = d.current.time.slice(0, 13);
  const start = Math.max(
    0,
    d.hourly.time.findIndex((t: string) => t.slice(0, 13) > nowHour),
  );

  const hours = [];
  for (let i = start; i < d.hourly.time.length && hours.length < 6; i += 2) {
    hours.push({
      hour: d.hourly.time[i].slice(11, 13) + "h",
      temp: d.hourly.temperature_2m[i],
      rain: d.hourly.precipitation_probability[i] ?? 0,
      code: d.hourly.weather_code[i],
      isDay: d.hourly.is_day[i] === 1,
    });
  }

  const days = d.daily.time.map((date: string, i: number) => ({
    date,
    code: d.daily.weather_code[i],
    min: d.daily.temperature_2m_min[i],
    max: d.daily.temperature_2m_max[i],
    rain: d.daily.precipitation_probability_max[i] ?? 0,
  }));

  return {
    now: {
      temp: d.current.temperature_2m,
      feels: d.current.apparent_temperature,
      code: d.current.weather_code,
      isDay: d.current.is_day === 1,
      wind: d.current.wind_speed_10m,
      gusts: d.current.wind_gusts_10m,
      humidity: d.current.relative_humidity_2m,
    },
    hours,
    days,
    sunrise: d.daily.sunrise[0].slice(11, 16),
    sunset: d.daily.sunset[0].slice(11, 16),
  };
}

// WMO weather codes -> French label + icon file in assets/icons.
export function describe(code: number, isDay = true): { label: string; icon: string } {
  const clear = isDay ? "sun" : "moon";
  if (code === 0) return { label: "Ciel dégagé", icon: clear };
  if (code === 1) return { label: "Peu nuageux", icon: clear };
  if (code === 2) return { label: "Partiellement nuageux", icon: "cloud" };
  if (code === 3) return { label: "Couvert", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Brouillard", icon: "cloud-fog" };
  if (code >= 51 && code <= 57) return { label: "Bruine", icon: "cloud-rain" };
  if (code >= 61 && code <= 67) return { label: "Pluie", icon: "cloud-rain" };
  if (code >= 71 && code <= 77) return { label: "Neige", icon: "cloud-snow" };
  if (code >= 80 && code <= 82) return { label: "Averses", icon: "cloud-rain" };
  if (code === 85 || code === 86) return { label: "Averses de neige", icon: "cloud-snow" };
  if (code >= 95) return { label: "Orage", icon: "cloud-storm" };
  return { label: "—", icon: "cloud" };
}

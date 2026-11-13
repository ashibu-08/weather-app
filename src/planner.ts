export type Activity = {
  id: string;
  name: string;
  time: string;
  duration: string;
  type: "Outdoors" | "Indoors";
  icon: string;
  flexible: boolean;
};
export type Hour = {
  time: string;
  temperature: number;
  rain: number;
  code: number;
  wind: number;
};
export type Forecast = {
  hours: Hour[];
  daily: {
    date: string;
    high: number;
    low: number;
    rain: number;
    code: number;
  }[];
  timezone: string;
  fetchedAt: string;
};
export type Preferences = {
  location: string;
  unit: "C" | "F";
  rainThreshold: number;
  comfortableRange: string;
  forecastAlerts: boolean;
  flexibleDefault: boolean;
  gapMinutes: number;
  planningHours: string;
  maxWind: number;
};
export type SuggestedChange = Activity & {
  before: string;
  after: string;
  note: string;
};
export const defaults: Preferences = {
  location: "Portland, OR",
  unit: "C",
  rainThreshold: 40,
  comfortableRange: "15–24°C",
  forecastAlerts: true,
  flexibleDefault: true,
  gapMinutes: 30,
  planningHours: "8 AM–6 PM",
  maxWind: 30,
};
export const cities: Record<
  string,
  { lat: number; lon: number; timezone: string }
> = {
  "Portland, OR": {
    lat: 45.5152,
    lon: -122.6784,
    timezone: "America/Los_Angeles",
  },
  "Seattle, WA": {
    lat: 47.6062,
    lon: -122.3321,
    timezone: "America/Los_Angeles",
  },
  "San Francisco, CA": {
    lat: 37.7749,
    lon: -122.4194,
    timezone: "America/Los_Angeles",
  },
  "New York, NY": { lat: 40.7128, lon: -74.006, timezone: "America/New_York" },
};
export function dateInZone(timezone = "America/Los_Angeles") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function durationInMinutes(duration: string) {
  const h = duration.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const m = duration.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}
export function parseTime(value: string, fallback?: string) {
  const m = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return NaN;
  let h = Number(m[1]);
  const minute = Number(m[2] || 0);
  const suffix = m[3]?.toUpperCase() || fallback;
  if (minute > 59 || (suffix ? h < 1 || h > 12 : h > 23)) return NaN;
  if (suffix) h = (h % 12) + (suffix === "PM" ? 12 : 0);
  return h * 60 + minute;
}
export function startMinute(time: string) {
  const parts = time.split(/[–—-]/);
  const suffix = parts[1]?.match(/(AM|PM)/i)?.[1]?.toUpperCase();
  return parseTime(parts[0], suffix);
}
export function formatTime(minute: number) {
  const h = Math.floor(minute / 60);
  return `${h % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export function timeRange(start: number, duration: number) {
  return `${formatTime(start)}–${formatTime(start + duration)}`;
}
export function activityError(a: Activity) {
  if (!a.name.trim()) return "Give your activity a name.";
  const start = startMinute(a.time),
    duration = durationInMinutes(a.duration);
  if (!Number.isFinite(start)) return "Use a time such as 9:00 AM or 2:30 PM.";
  if (duration < 15 || duration > 720 || duration % 15 !== 0)
    return "Use a duration from 15 minutes to 12 hours, in 15-minute steps.";
  if (start + duration > 1440)
    return "This activity must finish before midnight.";
  return "";
}
export function hoursFor(
  forecast: Forecast | null,
  date: string,
  start: number,
  duration: number,
) {
  const hours =
    forecast?.hours.filter(
      (h) =>
        h.time.startsWith(date) &&
        Number(h.time.slice(11, 13)) * 60 < start + duration &&
        Number(h.time.slice(11, 13)) * 60 + 60 > start,
    ) ?? [];
  return hours.length === Math.ceil(((start % 60) + duration) / 60)
    ? hours
    : [];
}
export function weatherFits(
  hours: Hour[],
  prefs: Preferences,
  duration: number,
) {
  if (hours.length < Math.ceil(duration / 60)) return false;
  const [low, high] = prefs.comfortableRange.match(/\d+/g)!.map(Number);
  return hours.every(
    (h) =>
      h.rain <= prefs.rainThreshold &&
      h.temperature >= low &&
      h.temperature <= high &&
      h.wind <= prefs.maxWind &&
      ![95, 96, 99].includes(h.code),
  );
}
export function planSchedule(
  activities: Activity[],
  prefs: Preferences,
  forecast: Forecast | null,
  date: string,
  now = new Date(),
) {
  const issues: string[] = [];
  const changes: SuggestedChange[] = [];
  if (activities.some((a) => activityError(a)))
    return {
      changes,
      issues: ["Finish editing invalid activities before scheduling."],
    };
  const bounds = prefs.planningHours.split("–");
  let first = parseTime(bounds[0]);
  const last = parseTime(bounds[1]);
  const timezone = cities[prefs.location]?.timezone;
  if (date === dateInZone(timezone)) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const minutes =
      Number(parts.find((p) => p.type === "hour")?.value) * 60 +
      Number(parts.find((p) => p.type === "minute")?.value);
    first = Math.max(first, Math.ceil(minutes / 15) * 15);
  }
  if (date < dateInZone(timezone))
    return {
      changes,
      issues: ["Choose today or a future date to find a schedule."],
    };
  // Unscheduled activities reserve their original slot. Each proposed move must also
  // fit around those reservations, so a partial set of suggestions is safe to apply.
  const slots = new Map(
    activities.map((a) => [
      a.id,
      {
        start: startMinute(a.time),
        end: startMinute(a.time) + durationInMinutes(a.duration),
      },
    ]),
  );
  const fixed = activities.filter((a) => !a.flexible);
  fixed.forEach((a, i) =>
    fixed.slice(i + 1).forEach((b) => {
      const x = slots.get(a.id)!,
        y = slots.get(b.id)!;
      if (x.start < y.end && y.start < x.end)
        issues.push(`${a.name} overlaps ${b.name}. Adjust a fixed time.`);
    }),
  );
  if (issues.length) return { changes, issues };
  const flexible = activities
    .filter((a) => a.flexible)
    .sort(
      (a, b) => Number(b.type === "Outdoors") - Number(a.type === "Outdoors"),
    );
  for (const a of flexible) {
    const duration = durationInMinutes(a.duration),
      original = slots.get(a.id)!;
    const options: { start: number; score: number }[] = [];
    for (let start = first; start + duration <= last; start += 15) {
      if (
        [...slots].some(
          ([id, s]) =>
            id !== a.id &&
            start < s.end + prefs.gapMinutes &&
            start + duration + prefs.gapMinutes > s.start,
        )
      )
        continue;
      const hours = hoursFor(forecast, date, start, duration);
      if (a.type === "Outdoors" && !weatherFits(hours, prefs, duration))
        continue;
      const rain = hours.length
        ? hours.reduce((s, h) => s + h.rain, 0) / hours.length
        : 0;
      options.push({
        start,
        score:
          Math.abs(start - original.start) +
          (a.type === "Outdoors" ? rain * 3 : 0),
      });
    }
    options.sort((a, b) => a.score - b.score);
    if (!options.length) {
      issues.push(
        `${a.name}: no ${a.type === "Outdoors" ? "weather-safe " : ""}slot fits your hours and other events. Original time kept.`,
      );
      continue;
    }
    const best = options[0].start;
    slots.set(a.id, { start: best, end: best + duration });
    if (best !== original.start) {
      const hours = hoursFor(forecast, date, best, duration);
      const note =
        a.type === "Outdoors"
          ? `Forecast across this activity: up to ${Math.max(...hours.map((h) => h.rain))}% rain, ${Math.round(Math.min(...hours.map((h) => h.temperature)))}–${Math.round(Math.max(...hours.map((h) => h.temperature)))}°C, wind up to ${Math.round(Math.max(...hours.map((h) => h.wind)))} km/h. Fits your limits.`
          : "Fits around your other plans and keeps your preferred buffer.";
      changes.push({
        ...a,
        before: a.time,
        after: timeRange(best, duration),
        note,
      });
    }
  }
  return { changes, issues };
}
export function weatherLabel(code: number) {
  return code === 0
    ? "Clear sky"
    : code <= 3
      ? "Partly cloudy"
      : code <= 48
        ? "Foggy"
        : code <= 67
          ? "Rain"
          : code <= 77
            ? "Snow"
            : code <= 82
              ? "Rain showers"
              : code <= 86
                ? "Snow showers"
                : "Thunderstorms";
}
export function weatherIcon(code: number) {
  return code <= 2 ? "1713c.svg" : code <= 48 ? "0fe59.svg" : "12c99.svg";
}
export async function fetchForecast(
  location: string,
  signal?: AbortSignal,
): Promise<Forecast> {
  const city = cities[location];
  if (!city) throw new Error("Choose a supported location.");
  const query = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    hourly:
      "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
    timezone: city.timezone,
    forecast_days: "7",
  });
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${query}`,
    { signal },
  );
  if (!response.ok)
    throw new Error("Forecast provider is unavailable. Try again shortly.");
  const data = await response.json();
  if (!data.hourly?.time?.length || !data.daily?.time?.length)
    throw new Error("Forecast provider returned incomplete data.");
  return {
    timezone: data.timezone,
    fetchedAt: new Date().toISOString(),
    hours: data.hourly.time
      .map((time: string, i: number) => ({
        time,
        temperature: data.hourly.temperature_2m[i],
        rain: data.hourly.precipitation_probability[i],
        code: data.hourly.weather_code[i],
        wind: data.hourly.wind_speed_10m[i],
      }))
      .filter((h: Hour) =>
        [h.temperature, h.rain, h.code, h.wind].every(
          (v) => typeof v === "number" && Number.isFinite(v),
        ),
      ),
    daily: data.daily.time.map((date: string, i: number) => ({
      date,
      high: data.daily.temperature_2m_max[i],
      low: data.daily.temperature_2m_min[i],
      rain: data.daily.precipitation_probability_max[i],
      code: data.daily.weather_code[i],
    })),
  };
}
function escapeCalendar(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
export function calendarFile(
  activities: Activity[],
  date: string,
  timezone: string,
) {
  const stamp = (m: number) => {
    const day = new Date(date + "T12:00:00Z");
    if (m >= 1440) day.setUTCDate(day.getUTCDate() + 1);
    return `${day.toISOString().slice(0, 10).replace(/-/g, "")}T${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}00`;
  };
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fieldday//Planner//EN",
    "CALSCALE:GREGORIAN",
    ...activities.flatMap((a) => [
      "BEGIN:VEVENT",
      `UID:${a.id.replace(/[^a-zA-Z0-9-]/g, "")}-${date}@fieldday.app`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
      `DTSTART;TZID=${timezone}:${stamp(startMinute(a.time))}`,
      `DTEND;TZID=${timezone}:${stamp(startMinute(a.time) + durationInMinutes(a.duration))}`,
      `SUMMARY:${escapeCalendar(a.name)}`,
      `DESCRIPTION:${escapeCalendar(`${a.type} activity planned with Fieldday`)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

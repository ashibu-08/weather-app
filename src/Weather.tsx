import { createContext, useContext } from "react";
import {
  weatherIcon,
  weatherLabel,
  type Forecast,
  type Preferences,
  hoursFor,
  weatherFits,
} from "./planner";
export const WeatherContext = createContext<{
  forecast: Forecast | null;
  date: string;
  preferences: Preferences;
  loading: boolean;
  error: string;
  refresh: () => void;
}>({
  forecast: null,
  date: "",
  preferences: {} as Preferences,
  loading: false,
  error: "",
  refresh: () => {},
});
export const useWeather = () => useContext(WeatherContext);
export function temp(n: number, unit: "C" | "F") {
  return `${Math.round(unit === "C" ? n : (n * 9) / 5 + 32)}°${unit}`;
}
const icon = (code: number, size = 24) => (
  <img
    src={`${import.meta.env.BASE_URL}assets/${weatherIcon(code)}`}
    width={size}
    height={size}
    alt={weatherLabel(code)}
  />
);
export function WeatherSummary({
  detailed = false,
}: {
  detailed?: boolean;
  unit?: string;
  offset?: number;
}) {
  const { forecast, date, preferences, loading } = useWeather();
  const hours = forecast?.hours.filter((h) => h.time.startsWith(date)) ?? [];
  const daily = forecast?.daily.find((d) => d.date === date);
  return (
    <section className={`weather-summary ${detailed ? "detailed" : ""}`}>
      <div className="forecast-line">
        {daily ? icon(daily.code) : null}
        {daily
          ? `${weatherLabel(daily.code)} · ${temp(daily.low, preferences.unit)} to ${temp(daily.high, preferences.unit)}`
          : loading
            ? "Fetching the latest forecast…"
            : "Forecast unavailable for this date"}
      </div>
      {detailed && (
        <div className="hourly">
          {[9, 12, 15, 18].map((h) => {
            const hour = hours.find((x) => Number(x.time.slice(11, 13)) === h);
            return hour ? (
              <div key={h}>
                <span>
                  {h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}
                </span>
                {icon(hour.code)}
                <strong>{temp(hour.temperature, preferences.unit)}</strong>
                <span>{hour.rain}% rain</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </section>
  );
}
export function WeatherPage({
  go,
  setLocation,
  setUnit,
}: {
  go: (screen: "plan" | "today" | "weather" | "you") => void;
  setLocation: (v: string) => void;
  setUnit: (v: "C" | "F") => void;
}) {
  const {
    forecast,
    date,
    preferences: p,
    loading,
    error,
    refresh,
  } = useWeather();
  const hours = forecast?.hours.filter((h) => h.time.startsWith(date)) ?? [];
  const safe = hours.filter((h) => weatherFits([h], p, 60));
  return (
    <main className="page weather-page">
      <header className="weather-header">
        <div>
          <p>YOUR LOCAL FORECAST</p>
          <h1>{p.location.split(",")[0]} weather</h1>
          <select
            className="weather-location"
            value={p.location}
            onChange={(e) => setLocation(e.target.value)}
            aria-label="Forecast location"
          >
            {[
              "Portland, OR",
              "Seattle, WA",
              "San Francisco, CA",
              "New York, NY",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <button
          className="unit-toggle"
          onClick={() => setUnit(p.unit === "C" ? "F" : "C")}
          aria-label="Change temperature unit"
        >
          °{p.unit}
        </button>
      </header>
      <WeatherSummary detailed />
      <section className="current-weather">
        <div className="current-copy">
          <h2>
            {safe.length
              ? "A little room for outside."
              : "Keep an eye on the forecast."}
          </h2>
          <p>
            {safe.length
              ? `${safe.length} hourly windows meet your rain, temperature and wind preferences.`
              : "No hourly windows meet all your outdoor preferences on this date. Try a different day or adjust your limits."}
          </p>
        </div>
      </section>
      <section className="forecast-list">
        <h2>7-day forecast</h2>
        {forecast?.daily.map((d) => (
          <article key={d.date}>
            {icon(d.code, 26)}
            <div>
              <strong>
                {new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </strong>
              <span>{weatherLabel(d.code)}</span>
            </div>
            <small>{d.rain}% rain</small>
            <p>
              <strong>{temp(d.high, p.unit)}</strong> / {temp(d.low, p.unit)}
            </p>
          </article>
        ))}
      </section>
      <section className="weather-hours">
        <h2>Hourly details</h2>
        <p className="muted">Rain probability · Temperature · Wind (km/h)</p>
        <div className="hour-table">
          {hours.map((h) => (
            <div key={h.time}>
              <span>{h.time.slice(11)}</span>
              {icon(h.code, 20)}
              <span>{h.rain}%</span>
              <span>{temp(h.temperature, p.unit)}</span>
              <span>{Math.round(h.wind)}</span>
              <span
                aria-label={
                  weatherFits([h], p, 60)
                    ? "Fits preferences"
                    : "Outside preferences"
                }
              >
                {weatherFits([h], p, 60) ? "✓" : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>
      <p className="source-note">
        Forecasts by{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        . Updated{" "}
        {forecast
          ? new Date(forecast.fetchedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })
          : "—"}
        . Forecasts can change; check local alerts before heading out.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="secondary-button" disabled={loading} onClick={refresh}>
        {loading ? "Refreshing…" : "Refresh forecast"}
      </button>
      <button className="primary-button" onClick={() => go("plan")}>
        Plan around the weather
      </button>
    </main>
  );
}

import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  SuggestedChange,
  durationInMinutes,
  fetchForecast,
  startMinute,
  timeRange,
  activityError,
  planSchedule,
  cities,
  dateInZone,
  hoursFor,
  weatherFits,
  calendarFile,
  type Forecast,
} from "./planner";
import { cloud, useWorkspace, isWorkspace, download } from "./services";
import { Auth } from "./Auth";
import {
  WeatherSummary,
  WeatherPage,
  WeatherContext,
  useWeather,
} from "./Weather";
import { AICoach, AIContext } from "./ai";

const A = `${import.meta.env.BASE_URL}assets/`;

type Screen = "today" | "plan" | "review" | "weather" | "you";
type Unit = "C" | "F";
function formatRange(range: string, unit: Unit) {
  if (unit === "C") return range;
  return range
    .replace(/\d+/g, (n) => String(Math.round((Number(n) * 9) / 5 + 32)))
    .replace("°C", "°F");
}

function Icon({
  src,
  size = 20,
  alt = "",
}: {
  src: string;
  size?: number;
  alt?: string;
}) {
  return (
    <img
      className="icon"
      src={`${A}${src}`}
      width={size}
      height={size}
      alt={alt}
    />
  );
}

function Brand() {
  return (
    <div className="brand">
      <Icon src="ace9a.svg" size={25} />
      <span>fieldday</span>
    </div>
  );
}

function PrimaryButton({
  children,
  icon,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  icon?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} className="primary-button" onClick={onClick}>
      {icon && <Icon src={icon} size={17} />}
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

function TopContext({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="top-context">
      <button className="icon-button" onClick={onBack} aria-label="Go back">
        <Icon src="55dca.svg" />
      </button>
      <span>{title}</span>
      <div className="context-action">{action}</div>
    </div>
  );
}

const navItems = [
  {
    id: "today" as const,
    label: "Today",
    activeIcon: "e3fc5.svg",
    icon: "d5b1d.svg",
  },
  {
    id: "plan" as const,
    label: "Plan",
    activeIcon: "25a0c.svg",
    icon: "981e7.svg",
  },
  {
    id: "weather" as const,
    label: "Weather",
    activeIcon: "2be1d.svg",
    icon: "2be1d.svg",
  },
  {
    id: "you" as const,
    label: "You",
    activeIcon: "01aad.svg",
    icon: "4c690.svg",
  },
];

function BottomNav({
  screen,
  go,
}: {
  screen: Screen;
  go: (screen: Screen) => void;
}) {
  const active = screen === "review" ? "plan" : screen;
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={active === item.id ? "active" : ""}
          onClick={() => go(item.id)}
          aria-current={active === item.id ? "page" : undefined}
        >
          <span className="nav-icon">
            <Icon src={active === item.id ? item.activeIcon : item.icon} />
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function Today({
  go,
  accepted,
  activities,
  location,
  unit,
  weatherOffset,
  rainThreshold,
  suggestionCount,
}: {
  go: (screen: Screen) => void;
  accepted: boolean;
  activities: Activity[];
  location: string;
  unit: Unit;
  weatherOffset: number;
  rainThreshold: number;
  suggestionCount: number;
}) {
  const weather = useWeather();
  return (
    <>
      <main className="page today-page">
        <header className="app-header">
          <Brand />
          <button
            className="icon-button"
            onClick={() => go("plan")}
            aria-label="Add plan"
          >
            <Icon src="13e9c.svg" />
          </button>
        </header>
        <section className="day-heading">
          <p>YOUR DAY, YOUR WAY</p>
          <div>
            <h1>Today</h1>
            <span>{location}</span>
          </div>
        </section>
        <WeatherSummary detailed unit={unit} offset={weatherOffset} />
        <section className="agenda">
          <div className="section-heading">
            <h2>Your current plan</h2>
            <span>Saved</span>
          </div>
          {activities.length === 0 && (
            <div className="empty-agenda">
              <strong>No activities planned</strong>
              <span>
                Add a hike, a commute, a workout, or time in the garden.
              </span>
              <button className="primary-button" onClick={() => go("plan")}>
                Plan my day
              </button>
            </div>
          )}
          {activities.map((activity) => {
            const weatherHours = hoursFor(
              weather.forecast,
              weather.date,
              startMinute(activity.time),
              durationInMinutes(activity.duration),
            );
            const unknown = !weatherHours.length;
            const rainRisk =
              activity.type === "Outdoors" &&
              !unknown &&
              !weatherFits(
                weatherHours,
                weather.preferences,
                durationInMinutes(activity.duration),
              );
            const note = rainRisk
              ? "Outdoors · Outside your weather preferences"
              : activity.type === "Outdoors"
                ? unknown
                  ? "Outdoors · Forecast unavailable"
                  : "Outdoors · Fits your weather preferences"
                : "Indoors · A flexible block";
            return (
              <button
                className="agenda-item"
                key={activity.id}
                onClick={() => go("plan")}
              >
                <span className="activity-symbol">
                  <Icon src={activity.icon} />
                </span>
                <span className="agenda-copy">
                  <strong>{activity.name}</strong>
                  <span>
                    {activity.time} · {activity.duration}
                  </span>
                  <small className={rainRisk ? "warning" : ""}>{note}</small>
                </span>
                <Icon src="aa1f8.svg" size={14} />
              </button>
            );
          })}
        </section>
        {!accepted && suggestionCount > 0 && (
          <section className="ai-invite">
            <div>
              <Icon src="2c00e.svg" size={17} />
              <strong>A better fit for the forecast</strong>
            </div>
            <p>
              Fit your flexible plans around rain, temperature, wind, and the
              things you cannot move.
            </p>
            <PrimaryButton icon="8197c.svg" onClick={() => go("review")}>
              Review {suggestionCount} suggested{" "}
              {suggestionCount === 1 ? "change" : "changes"}
            </PrimaryButton>
          </section>
        )}
      </main>
      <BottomNav screen="today" go={go} />
    </>
  );
}

function ActivityCard({
  activity,
  index,
  setActivities,
}: {
  activity: Activity;
  index: number;
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(activity.name === "New activity");
  const [error, setError] = useState("");
  const duration = durationInMinutes(activity.duration);
  const update = (patch: Partial<Activity>) =>
    setActivities((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const remove = () =>
    setActivities((items) => items.filter((_, i) => i !== index));
  const beginEdit = () => {
    setEditing(true);
    setMenuOpen(false);
  };
  return (
    <article className={`activity-card ${editing ? "editing" : ""}`}>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="activity-title">
        <Icon src={activity.icon} size={18} />
        <input
          value={activity.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-label="Activity name"
          readOnly={!editing}
        />
        <div className="activity-menu-wrap">
          <button
            className="activity-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={`Options for ${activity.name}`}
            aria-expanded={menuOpen}
          >
            <Icon src="8d313.svg" size={18} />
          </button>
          {menuOpen && (
            <div className="activity-menu">
              <button onClick={beginEdit}>Edit activity</button>
              <button className="delete-action" onClick={remove}>
                Delete activity
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="time-grid">
        <label>
          PREFERRED TIME
          {editing ? (
            <input
              type="time"
              aria-label={`Start time for ${activity.name}`}
              value={
                Number.isFinite(startMinute(activity.time))
                  ? `${String(Math.floor(startMinute(activity.time) / 60)).padStart(2, "0")}:${String(startMinute(activity.time) % 60).padStart(2, "0")}`
                  : ""
              }
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                if (Number.isFinite(h))
                  update({ time: timeRange(h * 60 + m, duration || 30) });
              }}
            />
          ) : (
            <input value={activity.time} readOnly />
          )}
        </label>
        <label>
          DURATION
          {editing ? (
            <select
              aria-label={`Duration for ${activity.name}`}
              value={duration}
              onChange={(e) => {
                const minutes = Number(e.target.value);
                update({
                  duration: `${minutes} minutes`,
                  time: timeRange(startMinute(activity.time), minutes),
                });
              }}
            >
              {Array.from({ length: 48 }, (_, i) => (i + 1) * 15).map((m) => (
                <option key={m} value={m}>
                  {m < 60
                    ? `${m} minutes`
                    : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`}
                </option>
              ))}
            </select>
          ) : (
            <input value={activity.duration} readOnly />
          )}
        </label>
      </div>
      <div className="activity-settings">
        <button
          type="button"
          className="activity-type"
          disabled={!editing}
          onClick={() =>
            update({
              type: activity.type === "Outdoors" ? "Indoors" : "Outdoors",
              icon: activity.type === "Outdoors" ? "bbcd9.svg" : "a147f.svg",
            })
          }
        >
          {activity.type}
        </button>
        {editing ? (
          <button
            className="done-editing"
            onClick={() => {
              const problem = activityError(activity);
              setError(problem);
              if (!problem) setEditing(false);
            }}
          >
            Done
          </button>
        ) : (
          <div>
            Flexible time{" "}
            <Toggle
              checked={activity.flexible}
              onChange={(value) => update({ flexible: value })}
              label={`Flexible time for ${activity.name}`}
            />
          </div>
        )}
      </div>
    </article>
  );
}

function Plan({
  go,
  activities,
  setActivities,
  flexibleDefault,
  unit,
  weatherOffset,
}: {
  go: (screen: Screen) => void;
  activities: Activity[];
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
  flexibleDefault: boolean;
  unit: Unit;
  weatherOffset: number;
}) {
  const addActivity = () =>
    setActivities((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        name: "New activity",
        time: "5:30–6:00 PM",
        duration: "30 minutes",
        type: "Indoors",
        icon: "bbcd9.svg",
        flexible: flexibleDefault,
      },
    ]);
  return (
    <>
      <main className="page plan-page">
        <TopContext
          title="Your daily plan"
          onBack={() => go("today")}
          action={
            <button className="text-button" onClick={() => go("today")}>
              Save draft
            </button>
          }
        />
        <section className="page-intro">
          <h1>What’s in your day?</h1>
          <p>
            Start with your plan. Find a better time for anything that’s
            flexible.
          </p>
        </section>
        <WeatherSummary unit={unit} offset={weatherOffset} />
        <section className="activity-list">
          {activities.length === 0 && (
            <div className="empty-agenda">
              <strong>A little space for something good.</strong>
              <span>Add your first activity below.</span>
            </div>
          )}
          {activities.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              index={index}
              setActivities={setActivities}
            />
          ))}
        </section>
        <button className="add-activity" onClick={addActivity}>
          <span>＋</span>Add another activity
        </button>
        <div className="schedule-action">
          <PrimaryButton icon="2f5d2.svg" onClick={() => go("review")}>
            Find my best schedule
          </PrimaryButton>
          <small>Durations stay the same. You approve every change.</small>
        </div>
      </main>
      <BottomNav screen="plan" go={go} />
    </>
  );
}

function Review({
  go,
  changes,
  accept,
  location,
}: {
  go: (screen: Screen) => void;
  changes: SuggestedChange[];
  accept: () => void;
  location: string;
}) {
  const totalMinutes = changes.reduce(
    (total, change) => total + durationInMinutes(change.duration),
    0,
  );
  const totalLabel =
    totalMinutes % 60 === 0
      ? `${totalMinutes / 60} hours`
      : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  return (
    <>
      <main className="page review-page">
        <TopContext
          title={`Suggested schedule · ${location}`}
          onBack={() => go("plan")}
          action={<span />}
        />
        <section className="review-intro">
          <span>Weather-aware suggestion · Not applied</span>
          <h1>Let the weather lead.</h1>
          <p>
            A schedule shaped by the forecast and your preferences. Fixed events
            stay in place.
          </p>
        </section>
        <AICoach changes={changes} />
        <section className="changes">
          {changes.map((change) => (
            <article className="change-card" key={change.id}>
              <div className="change-heading">
                <Icon src={change.icon} size={18} />
                <strong>{change.name}</strong>
                <span>{change.duration}</span>
              </div>
              <div className="before">
                <span>Before</span>
                <s>{change.before}</s>
              </div>
              <div className="after">
                <span>After</span>
                <strong>{change.after}</strong>
              </div>
              <p>{change.note}</p>
            </article>
          ))}
        </section>
        {changes.length > 0 ? (
          <div className="validation">
            <Icon src="8cc39.svg" size={16} />
            Suggested moves checked · {totalLabel} preserved
          </div>
        ) : (
          <div className="empty-agenda">
            <strong>No changes to suggest</strong>
            <span>
              Your current slots may already fit. Check any scheduling notices
              above, or adjust flexibility and preferences.
            </span>
          </div>
        )}
        <section className="approval">
          {changes.length > 0 && (
            <PrimaryButton icon="418aa.svg" onClick={accept}>
              Accept{" "}
              {changes.length === 1
                ? "change"
                : `all ${changes.length} changes`}
            </PrimaryButton>
          )}
          <div>
            <button onClick={() => go("plan")}>Adjust times</button>
            <button onClick={() => go("today")}>Keep original plan</button>
          </div>
          <small>Your saved plan won’t change until you accept.</small>
        </section>
      </main>
      <BottomNav screen="review" go={go} />
    </>
  );
}

function Setting({
  title,
  subtitle,
  value,
  children,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="setting">
      <div>
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function You({
  go,
  location,
  setLocation,
  unit,
  setUnit,
  rainThreshold,
  setRainThreshold,
  comfortableRange,
  setComfortableRange,
  forecastAlerts,
  setForecastAlerts,
  flexibleDefault,
  setFlexibleDefault,
  gapMinutes,
  setGapMinutes,
  planningHours,
  setPlanningHours,
}: {
  go: (screen: Screen) => void;
  location: string;
  setLocation: (location: string) => void;
  unit: Unit;
  setUnit: (unit: Unit) => void;
  rainThreshold: number;
  setRainThreshold: (threshold: number) => void;
  comfortableRange: string;
  setComfortableRange: (range: string) => void;
  forecastAlerts: boolean;
  setForecastAlerts: (alerts: boolean) => void;
  flexibleDefault: boolean;
  setFlexibleDefault: (flexible: boolean) => void;
  gapMinutes: number;
  setGapMinutes: (minutes: number) => void;
  planningHours: string;
  setPlanningHours: (hours: string) => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <main className="page you-page">
        <TopContext
          title="Your Fieldday"
          onBack={() => go("today")}
          action={<span />}
        />
        <h1>Account &amp; preferences</h1>
        <section className="settings-section">
          <h2>Home base</h2>
          <Setting title="Location" subtitle="Used for your daily forecast">
            <select
              className="setting-select"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              aria-label="Home location"
            >
              <option>Portland, OR</option>
              <option>Seattle, WA</option>
              <option>San Francisco, CA</option>
              <option>New York, NY</option>
            </select>
          </Setting>
          <Setting title="Temperature">
            <select
              className="setting-select"
              value={unit}
              onChange={(event) => setUnit(event.target.value as Unit)}
              aria-label="Temperature unit"
            >
              <option value="C">Celsius · °C</option>
              <option value="F">Fahrenheit · °F</option>
            </select>
          </Setting>
        </section>
        <section className="weather-preferences">
          <h2>
            <Icon src="fa37e.svg" size={18} />
            Your kind of weather
          </h2>
          <Setting title="Avoid outdoor rain above">
            <select
              className="setting-select"
              value={rainThreshold}
              onChange={(event) => setRainThreshold(Number(event.target.value))}
              aria-label="Outdoor rain threshold"
            >
              <option value={20}>20% chance</option>
              <option value={40}>40% chance</option>
              <option value={60}>60% chance</option>
              <option value={90}>90% chance</option>
            </select>
          </Setting>
          <Setting title="Comfortable temperature">
            <select
              className="setting-select"
              value={comfortableRange}
              onChange={(event) => setComfortableRange(event.target.value)}
              aria-label="Comfortable temperature range"
            >
              <option value="10–20°C">{formatRange("10–20°C", unit)}</option>
              <option value="15–24°C">{formatRange("15–24°C", unit)}</option>
              <option value="18–27°C">{formatRange("18–27°C", unit)}</option>
              <option value="21–30°C">{formatRange("21–30°C", unit)}</option>
            </select>
          </Setting>
          <Setting
            title="Forecast alerts"
            subtitle="When weather affects your plan"
          >
            <Toggle
              checked={forecastAlerts}
              onChange={setForecastAlerts}
              label="Forecast alerts"
            />
          </Setting>
        </section>
        <section className="settings-section">
          <h2>A little room to move</h2>
          <Setting
            title="Flexible by default"
            subtitle="New activities can be suggested at other times"
          >
            <Toggle
              checked={flexibleDefault}
              onChange={setFlexibleDefault}
              label="Flexible by default"
            />
          </Setting>
          <Setting title="Time between activities">
            <select
              className="setting-select"
              value={gapMinutes}
              onChange={(event) => setGapMinutes(Number(event.target.value))}
              aria-label="Time between activities"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </Setting>
          <Setting title="Planning hours">
            <select
              className="setting-select"
              value={planningHours}
              onChange={(event) => setPlanningHours(event.target.value)}
              aria-label="Planning hours"
            >
              <option>7 AM–7 PM</option>
              <option>8 AM–6 PM</option>
              <option>9 AM–5 PM</option>
            </select>
          </Setting>
        </section>
        <div className="save-preferences">
          <PrimaryButton onClick={() => setSaved(true)}>
            {saved ? "Preferences saved" : "Save preferences"}
          </PrimaryButton>
          <small>Fieldday always asks before changing your schedule.</small>
        </div>
      </main>
      <BottomNav screen="you" go={go} />
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(!cloud),
    [local, setLocal] = useState(
      () => sessionStorage.getItem("fieldday.local") === "1",
    );
  const [recovery, setRecovery] = useState(false);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    if (!cloud) return;
    cloud.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) setAuthError(error.message);
        setSession(data.session);
        setAuthReady(true);
      })
      .catch(() => {
        setAuthError(
          "Account service unavailable. You can continue on this device.",
        );
        setAuthReady(true);
      });
    const {
      data: { subscription },
    } = cloud.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  if (!authReady)
    return (
      <div className="loading-screen" role="status">
        Opening your Fieldday…
      </div>
    );
  if (recovery || (!session && !local))
    return (
      <>
        {authError && (
          <p role="alert" className="form-error">
            {authError}
          </p>
        )}
        <Auth
          recovery={recovery}
          onRecovered={() => setRecovery(false)}
          onLocal={() => {
            sessionStorage.setItem("fieldday.local", "1");
            setLocal(true);
          }}
        />
      </>
    );
  return (
    <WorkspaceApp
      key={session?.user.id || "local"}
      session={session}
      onSignOut={async () => {
        if (cloud && session) {
          const { error } = await cloud.auth.signOut();
          if (error) {
            setAuthError(error.message);
            return;
          }
        }
        sessionStorage.removeItem("fieldday.local");
        setLocal(false);
      }}
    />
  );
}
function WorkspaceApp({
  session,
  onSignOut,
}: {
  session: Session | null;
  onSignOut: () => Promise<void>;
}) {
  const { data, setData, ready, status, storageError, retrySync } =
    useWorkspace(session?.user.id);
  const [screen, setScreen] = useState<Screen>("today");
  const [date, setDate] = useState(() => dateInZone());
  const [forecast, setForecast] = useState<Forecast | null>(null),
    [loading, setLoading] = useState(false),
    [weatherError, setWeatherError] = useState(""),
    [refreshId, setRefreshId] = useState(0);
  const [accepted, setAccepted] = useState(false),
    [notice, setNotice] = useState("");
  const p = data.preferences;
  const activities = data.days[date] || [];
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setForecast(null);
    setLoading(true);
    setWeatherError("");
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetchForecast(p.location, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setForecast(result);
      })
      .catch((e) => {
        if (cancelled) return;
        if (!controller.signal.aborted)
          setWeatherError(e.message || "Unable to load the forecast.");
        else
          setWeatherError("Forecast request timed out. Refresh to try again.");
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });
    let cancelled = false;
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [p.location, ready, refreshId]);
  useEffect(() => {
    const timer = setInterval(() => setRefreshId((n) => n + 1), 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setAccepted(false);
  }, [date, p, forecast]);
  const updateActivities: React.Dispatch<React.SetStateAction<Activity[]>> = (
    next,
  ) => {
    setAccepted(false);
    setData((current) => {
      const items = current.days[date] || [];
      return {
        ...current,
        days: {
          ...current.days,
          [date]: typeof next === "function" ? next(items) : next,
        },
      };
    });
  };
  const pref = <K extends keyof typeof p>(key: K, value: (typeof p)[K]) =>
    setData((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
  const go = (next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const stale =
    !!forecast && Date.now() - Date.parse(forecast.fetchedAt) > 30 * 60 * 1000;
  const result = planSchedule(activities, p, stale ? null : forecast, date);
  const changes = result.changes;
  const accept = () => {
    const times = new Map(changes.map((c) => [c.id, c.after]));
    setData((current) => ({
      ...current,
      days: {
        ...current.days,
        [date]: (current.days[date] || []).map((a) => ({
          ...a,
          time: times.get(a.id) || a.time,
        })),
      },
    }));
    setAccepted(true);
    setNotice(
      "Suggested changes applied. Your other activities stayed in place.",
    );
    go("today");
  };
  const setLocation = (v: string) => pref("location", v),
    setUnit = (v: Unit) => pref("unit", v);
  const exportCalendar = () => {
    const error = activities.find((a) => activityError(a));
    if (error) {
      setNotice("Finish editing your activities before exporting.");
      return;
    }
    download(
      `fieldday-${date}.ics`,
      calendarFile(activities, date, cities[p.location].timezone),
      "text/calendar;charset=utf-8",
    );
    setNotice(
      "Calendar file downloaded. Import it into Apple, Google, or Outlook Calendar.",
    );
  };
  async function importBackup(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setNotice("Choose a Fieldday backup smaller than 2 MB.");
      return;
    }
    try {
      const value = JSON.parse(await file.text());
      if (!isWorkspace(value))
        throw new Error("This file is not a valid Fieldday backup.");
      if (
        !window.confirm(
          "Replace this workspace with the imported backup? Export a backup first if you want to keep your current plans.",
        )
      )
        return;
      setData(value);
      setNotice("Backup restored.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to import backup.");
    }
  }
  if (!ready)
    return (
      <div className="loading-screen" role="status">
        Loading your plans…
      </div>
    );
  return (
    <WeatherContext.Provider
      value={{
        forecast,
        date,
        preferences: p,
        loading,
        error: weatherError,
        refresh: () => setRefreshId((n) => n + 1),
      }}
    >
      <AIContext.Provider value={{ activities, signedIn: !!session }}>
        <div className="app-shell">
          <div className="workspace-bar">
            <label>
              Planning date
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value);
                }}
                aria-label="Planning date"
              />
            </label>
            <span>
              {session ? "Cloud workspace" : "Device workspace"}
              <small role="status">{storageError || status}</small>
            </span>
          </div>
          {notice && (
            <div className="app-notice" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
          {weatherError && (
            <div className="app-notice warning" role="alert">
              Live weather unavailable. Outdoor suggestions pause until the
              forecast loads.
              <button onClick={() => setRefreshId((n) => n + 1)}>Retry</button>
            </div>
          )}
          {stale && (
            <div className="app-notice">
              Forecast is more than 30 minutes old. Refresh before planning
              outdoors.
              <button onClick={() => setRefreshId((n) => n + 1)}>
                Refresh
              </button>
            </div>
          )}
          {screen === "today" && (
            <Today
              go={go}
              accepted={accepted}
              activities={activities}
              location={p.location}
              unit={p.unit}
              weatherOffset={0}
              rainThreshold={p.rainThreshold}
              suggestionCount={changes.length}
            />
          )}
          {screen === "plan" && (
            <Plan
              go={go}
              activities={activities}
              setActivities={updateActivities}
              flexibleDefault={p.flexibleDefault}
              unit={p.unit}
              weatherOffset={0}
            />
          )}
          {screen === "review" && (
            <>
              {result.issues.length > 0 && (
                <div className="schedule-notices" role="status">
                  {result.issues.map((issue, i) => (
                    <p key={i}>{issue}</p>
                  ))}
                </div>
              )}
              <Review
                go={go}
                changes={changes}
                accept={accept}
                location={p.location}
              />
            </>
          )}
          {screen === "weather" && (
            <>
              <WeatherPage
                go={go}
                setLocation={setLocation}
                setUnit={setUnit}
              />
              <BottomNav screen="weather" go={go} />
            </>
          )}
          {screen === "you" && (
            <>
              <You
                go={go}
                location={p.location}
                setLocation={setLocation}
                unit={p.unit}
                setUnit={setUnit}
                rainThreshold={p.rainThreshold}
                setRainThreshold={(v) => pref("rainThreshold", v)}
                comfortableRange={p.comfortableRange}
                setComfortableRange={(v) => pref("comfortableRange", v)}
                forecastAlerts={p.forecastAlerts}
                setForecastAlerts={(v) => pref("forecastAlerts", v)}
                flexibleDefault={p.flexibleDefault}
                setFlexibleDefault={(v) => pref("flexibleDefault", v)}
                gapMinutes={p.gapMinutes}
                setGapMinutes={(v) => pref("gapMinutes", v)}
                planningHours={p.planningHours}
                setPlanningHours={(v) => pref("planningHours", v)}
              />
              <section className="workspace-tools">
                <h2>Your workspace</h2>
                <label className="profile-field">
                  Your name
                  <input
                    value={data.name}
                    placeholder={
                      session?.user.user_metadata.full_name || "Your name"
                    }
                    maxLength={100}
                    onChange={(e) =>
                      setData((d) => ({ ...d, name: e.target.value }))
                    }
                  />
                </label>
                <small>
                  {session?.user.email ||
                    "Plans are saved in this browser. Export a backup before changing devices."}
                </small>
                <Setting
                  title="Maximum outdoor wind"
                  subtitle="Wind speed in km/h"
                >
                  <select
                    className="setting-select"
                    value={p.maxWind}
                    onChange={(e) => pref("maxWind", Number(e.target.value))}
                    aria-label="Maximum outdoor wind"
                  >
                    {[15, 30, 45, 60].map((v) => (
                      <option key={v} value={v}>
                        {v} km/h
                      </option>
                    ))}
                  </select>
                </Setting>
                <button className="secondary-button" onClick={exportCalendar}>
                  Export selected day to calendar (.ics)
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    download(
                      "fieldday-backup.json",
                      JSON.stringify(data, null, 2),
                      "application/json",
                    )
                  }
                >
                  Download workspace backup
                </button>
                <label className="secondary-button file-label">
                  Restore backup
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      void importBackup(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {session && (
                  <button className="secondary-button" onClick={retrySync}>
                    Retry cloud save
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() =>
                    void onSignOut().catch(() =>
                      setNotice("Unable to sign out. Try again."),
                    )
                  }
                >
                  {session ? "Sign out" : "Back to welcome"}
                </button>
                <p className="source-note">
                  AI coach:{" "}
                  {cloud
                    ? "Sign in and deploy the weather-coach function to enable."
                    : "Optional backend not configured. See README for setup."}{" "}
                  No API key belongs in browser code.
                </p>
              </section>
            </>
          )}
          {screen === "today" &&
            p.forecastAlerts &&
            result.issues.length > 0 && (
              <section className="schedule-notices">
                <strong>Planning notices</strong>
                {result.issues.map((issue, i) => (
                  <p key={i}>{issue}</p>
                ))}
              </section>
            )}
        </div>
      </AIContext.Provider>
    </WeatherContext.Provider>
  );
}

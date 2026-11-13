import { createContext, useContext, useState } from "react";
import { cloud } from "./services";
import { useWeather } from "./Weather";
import { type Activity, type SuggestedChange } from "./planner";
export const AIContext = createContext<{
  activities: Activity[];
  signedIn: boolean;
}>({ activities: [], signedIn: false });
export function AICoach({ changes }: { changes: SuggestedChange[] }) {
  const { forecast, date, preferences } = useWeather(),
    { activities, signedIn } = useContext(AIContext);
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function explain() {
    if (!cloud || !signedIn) return;
    setBusy(true);
    setError("");
    setText("");
    try {
      const { data, error } = await cloud.functions.invoke("weather-coach", {
        body: {
          date,
          preferences,
          activities,
          changes,
          forecast: {
            hours: forecast?.hours.filter((h) => h.time.startsWith(date)),
            fetchedAt: forecast?.fetchedAt,
          },
        },
      });
      if (error)
        throw new Error(
          "AI coach is unavailable. Check the weather-coach function and server API key. Your schedule still works.",
        );
      if (data?.error) throw new Error(data.error);
      if (typeof data?.explanation !== "string")
        throw new Error("The AI returned an empty response. Try again.");
      setText(data.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI coach unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ai-coach">
      <span className="eyebrow">FIELDDAY AI COACH</span>
      <h2>A little context for your day.</h2>
      <p>
        {text ||
          "Get a plain-language explanation of the forecast, your preferences, and the suggested changes."}
      </p>
      {cloud && signedIn ? (
        <button
          className="secondary-button"
          disabled={busy || !forecast}
          onClick={explain}
        >
          {busy ? "Thinking about your day…" : "Explain with AI"}
        </button>
      ) : (
        <small>
          AI coach is optional.{" "}
          {cloud
            ? "Sign in with an account to use it."
            : "Enable Supabase and the server AI function to connect your API key."}{" "}
          Weather-aware scheduling works now without an AI key.
        </small>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

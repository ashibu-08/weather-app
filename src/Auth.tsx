import { useState, type FormEvent } from "react";
import { cloud } from "./services";
export function Auth({
  onLocal,
  recovery = false,
  onRecovered,
}: {
  onLocal: () => void;
  recovery?: boolean;
  onRecovered: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [show, setShow] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cloud) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget),
      email = String(form.get("email") || ""),
      password = String(form.get("password") || "");
    try {
      if (recovery) {
        const { error } = await cloud.auth.updateUser({ password });
        if (error) throw error;
        onRecovered();
      } else if (mode === "reset") {
        const { error } = await cloud.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.href.split("#")[0],
        });
        if (error) throw error;
        setMessage("Check your email for a password reset link.");
      } else if (mode === "signup") {
        const { data, error } = await cloud.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(form.get("name") || "") },
            emailRedirectTo: window.location.href.split("#")[0],
          },
        });
        if (error) throw error;
        if (!data.session)
          setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await cloud.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to continue. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const title = recovery
    ? "A fresh start."
    : mode === "signup"
      ? "Make the day yours."
      : mode === "reset"
        ? "Reset your password."
        : "Make room for your day.";
  return (
    <main className="auth-screen">
      <div className="auth-header">
        <div className="brand">
          <img
            src={`${import.meta.env.BASE_URL}assets/ace9a.svg`}
            width="25"
            alt=""
          />
          <span>fieldday</span>
        </div>
        <a
          href="#help"
          onClick={(e) => {
            e.preventDefault();
            setMessage(
              "Add activities in Plan, choose your weather preferences in You, then review suggestions. Your plan changes only when you approve.",
            );
          }}
        >
          Help
        </a>
      </div>
      <section className="auth-intro signin-intro">
        <p className="eyebrow">A LITTLE MORE ROOM FOR YOUR DAY</p>
        <h1>{title}</h1>
        <p>Your plans, a little more in tune with the weather.</p>
      </section>
      <div className="weather-note">
        <img
          src={`${import.meta.env.BASE_URL}assets/07e42.svg`}
          width="35"
          alt=""
        />
        <div>
          <strong>Make space for the sunshine.</strong>
          <span>Weather-aware plans. Every change is yours to approve.</span>
        </div>
      </div>
      {cloud ? (
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && !recovery && (
            <label>
              Full name
              <input name="name" autoComplete="name" maxLength={100} required />
            </label>
          )}
          {!recovery && (
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {(mode !== "reset" || recovery) && (
            <label>
              Password
              <div className="password-wrap">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={
                    mode === "signup" || recovery
                      ? "new-password"
                      : "current-password"
                  }
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          )}
          {mode === "signup" && (
            <small>
              At least 8 characters. Your account stores plans securely in your
              configured Supabase project.
            </small>
          )}
          <button className="primary-button" disabled={busy}>
            {busy
              ? "Please wait…"
              : recovery
                ? "Save new password"
                : mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
          </button>
          {!recovery && (
            <div className="auth-links">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError("");
                  setMessage("");
                }}
              >
                {mode === "signup"
                  ? "Already have an account? Sign in"
                  : "Create an account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "reset" ? "signin" : "reset");
                  setError("");
                  setMessage("");
                }}
              >
                {mode === "reset" ? "Back to sign in" : "Forgot password?"}
              </button>
            </div>
          )}
        </form>
      ) : (
        <div className="local-intro">
          <strong>Your own space, ready to use.</strong>
          <p>
            Plan with live weather and save on this device. No account or API
            key needed.
          </p>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      {!recovery && (
        <button
          className={cloud ? "secondary-button" : "primary-button"}
          onClick={onLocal}
        >
          {cloud ? "Continue on this device" : "Start planning"}
        </button>
      )}
      <p className="privacy">
        {cloud
          ? "Account plans sync to your cloud. Device mode stays in this browser."
          : "Device mode · Export backups to keep a copy of your plans."}
      </p>
    </main>
  );
}

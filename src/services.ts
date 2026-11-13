import { createClient } from "@supabase/supabase-js";
import { useEffect, useState, useCallback } from "react";
import { defaults, type Activity, type Preferences } from "./planner";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloud = url && key ? createClient(url, key) : null;
export type Workspace = {
  version: 1;
  name: string;
  preferences: Preferences;
  days: Record<string, Activity[]>;
};
export const emptyWorkspace = (): Workspace => ({
  version: 1,
  name: "",
  preferences: { ...defaults },
  days: {},
});
export function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const v = value as Workspace,
    p = v.preferences;
  return (
    v.version === 1 &&
    typeof v.name === "string" &&
    v.name.length <= 100 &&
    !!p &&
    Object.keys(defaults).every(
      (k) =>
        typeof p[k as keyof Preferences] ===
        typeof defaults[k as keyof Preferences],
    ) &&
    [
      "Portland, OR",
      "Seattle, WA",
      "San Francisco, CA",
      "New York, NY",
    ].includes(p.location) &&
    ["C", "F"].includes(p.unit) &&
    [20, 40, 60, 90].includes(p.rainThreshold) &&
    ["10–20°C", "15–24°C", "18–27°C", "21–30°C"].includes(p.comfortableRange) &&
    [15, 30, 45, 60].includes(p.gapMinutes) &&
    ["7 AM–7 PM", "8 AM–6 PM", "9 AM–5 PM"].includes(p.planningHours) &&
    [15, 30, 45, 60].includes(p.maxWind) &&
    !!v.days &&
    typeof v.days === "object" &&
    !Array.isArray(v.days) &&
    Object.entries(v.days).every(
      ([date, items]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Array.isArray(items) &&
        items.length <= 100 &&
        new Set(items.map((a) => a.id)).size === items.length &&
        items.every(
          (a) =>
            a &&
            typeof a.id === "string" &&
            typeof a.name === "string" &&
            typeof a.time === "string" &&
            typeof a.duration === "string" &&
            typeof a.flexible === "boolean" &&
            ["Outdoors", "Indoors"].includes(a.type) &&
            /^[a-f0-9]+\.svg$/.test(a.icon),
        ),
    )
  );
}
export function useWorkspace(userId?: string) {
  const storageKey = `fieldday.workspace.v1.${userId || "local"}`;
  const [data, setData] = useState<Workspace>(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading workspace…");
  const [storageError, setStorageError] = useState("");
  const [retry, setRetry] = useState(0);
  const [cloudReady, setCloudReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    setCloudReady(false);
    setStorageError("");
    let local = emptyWorkspace();
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isWorkspace(parsed)) local = parsed;
        else
          setStorageError(
            "Saved data could not be read. Import a backup to restore it.",
          );
      }
    } catch {
      setStorageError(
        "Browser storage is unavailable. Export a backup before leaving.",
      );
    }
    async function load() {
      if (cloud && userId) {
        const { data: row, error } = await cloud
          .from("workspaces")
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();
        if (!active) return;
        if (error) {
          setStatus("Cloud unavailable · changes saved on this device");
        } else {
          if (
            isWorkspace(row?.data) &&
            localStorage.getItem(storageKey + ".pending") !== "1"
          )
            local = row.data;
          setCloudReady(true);
          setStatus("Cloud connected");
        }
      } else setStatus("Saved on this device");
      if (active) {
        setData(local);
        setReady(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [storageKey, userId, retry]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      setStorageError(
        "Unable to save on this device. Export a backup before leaving.",
      );
    }
    if (!cloud || !userId) return;
    try {
      localStorage.setItem(storageKey + ".pending", "1");
    } catch {}
    if (!cloudReady) return;
    setStatus("Saving to cloud…");
    let active = true;
    const timer = setTimeout(async () => {
      const { error } = await cloud!
        .from("workspaces")
        .upsert({
          user_id: userId,
          data,
          updated_at: new Date().toISOString(),
        });
      if (active) {
        if (!error) {
          try {
            if (localStorage.getItem(storageKey) === JSON.stringify(data))
              localStorage.removeItem(storageKey + ".pending");
          } catch {}
        }
        setStatus(
          error
            ? "Cloud save failed · export a backup or retry saving"
            : "Saved to cloud",
        );
      }
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data, ready, storageKey, userId, cloudReady]);
  const retrySync = useCallback(() => {
    // Preserve local unsynced work by retrying a write, not reloading cloud state.
    if (cloud && userId && ready) {
      setStatus("Retrying cloud save…");
      void cloud
        .from("workspaces")
        .upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) setStatus("Cloud save failed · check Supabase setup");
          else {
            try {
              if (localStorage.getItem(storageKey) === JSON.stringify(data))
                localStorage.removeItem(storageKey + ".pending");
            } catch {}
            setCloudReady(true);
            setStatus("Saved to cloud");
          }
        });
    } else setRetry((v) => v + 1);
  }, [userId, data, ready, storageKey]);
  return { data, setData, ready, status, storageError, retrySync };
}
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

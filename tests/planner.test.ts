import test from "node:test";
import assert from "node:assert/strict";
import {
  planSchedule,
  defaults,
  durationInMinutes,
  startMinute,
  activityError,
  calendarFile,
  hoursFor,
  type Activity,
  type Forecast,
} from "../src/planner.ts";
const date = "2099-01-01";
const activity = (
  id: string,
  time = "9:00 AM",
  type: "Outdoors" | "Indoors" = "Outdoors",
  flexible = true,
): Activity => ({
  id,
  name: id,
  time,
  duration: "60 minutes",
  type,
  flexible,
  icon: "a147f.svg",
});
const forecast = (
  overrides: Record<number, Partial<Forecast["hours"][number]>> = {},
): Forecast => ({
  timezone: "America/Los_Angeles",
  fetchedAt: new Date().toISOString(),
  daily: [],
  hours: Array.from({ length: 24 }, (_, h) => ({
    time: `${date}T${String(h).padStart(2, "0")}:00`,
    temperature: 20,
    rain: h < 12 ? 80 : 5,
    code: 0,
    wind: 10,
    ...overrides[h],
  })),
});
test("parses original Figma duration and time formats", () => {
  assert.equal(durationInMinutes("2 hours"), 120);
  assert.equal(durationInMinutes("1 hour 30 minutes"), 90);
  assert.equal(durationInMinutes("90 minutes"), 90);
  assert.equal(startMinute("9:00–11:00 AM"), 540);
  assert.equal(startMinute("11:30 AM–1:00 PM"), 690);
  assert.equal(startMinute("2:00–4:00 PM"), 840);
  assert.equal(startMinute("12:00 AM"), 0);
  assert.equal(startMinute("12:00 PM"), 720);
});
test("moves an outdoor event out of morning rain", () => {
  const result = planSchedule([activity("Hike")], defaults, forecast(), date);
  assert.equal(result.changes.length, 1);
  assert.ok(startMinute(result.changes[0].after) >= 720);
  assert.match(result.changes[0].note, /5% rain/);
});
test("checks rain throughout full activity including a partial ending hour", () => {
  const f = forecast({ 13: { rain: 90 } });
  const a = { ...activity("Garden", "12:30 PM"), duration: "90 minutes" };
  const { changes } = planSchedule([a], defaults, f, date);
  assert.equal(changes.length, 1);
  assert.ok(startMinute(changes[0].after) >= 840);
});
test("rejects incomplete hourly coverage", () => {
  const f = forecast();
  f.hours = f.hours.filter((h) => !h.time.endsWith("13:00"));
  assert.equal(hoursFor(f, date, 12 * 60 + 45, 60).length, 0);
});
test("temperature, wind, and thunderstorms can block outdoor suggestions", () => {
  for (const condition of [
    { temperature: 35 },
    { wind: 80 },
    { code: 95 },
    { rain: 90 },
  ]) {
    const f = forecast(
      Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, condition])),
    );
    const r = planSchedule([activity("Run")], defaults, f, date);
    assert.equal(r.changes.length, 0);
    assert.equal(r.issues.length, 1);
  }
});
test("never reschedules fixed events and leaves a buffer around them", () => {
  const fixed = activity("Appointment", "12:00 PM", "Indoors", false),
    a = activity("Hike");
  const { changes } = planSchedule([fixed, a], defaults, forecast(), date);
  assert.ok(changes.every((c) => c.id !== "Appointment"));
  assert.ok(startMinute(changes[0].after) >= 810);
});
test("does not propose overlapping suggestions and preserves durations", () => {
  const activities = [
    activity("Hike"),
    activity("Run", "10:30 AM"),
    activity("Garden", "2:00 PM"),
  ];
  const { changes } = planSchedule(activities, defaults, forecast(), date);
  const updated = activities
    .map((a) => ({
      ...a,
      time: changes.find((c) => c.id === a.id)?.after || a.time,
    }))
    .sort((a, b) => startMinute(a.time) - startMinute(b.time));
  for (let i = 1; i < updated.length; i++) {
    assert.ok(
      startMinute(updated[i].time) >=
        startMinute(updated[i - 1].time) +
          durationInMinutes(updated[i - 1].duration) +
          defaults.gapMinutes,
    );
  }
  assert.ok(changes.every((c) => c.duration === "60 minutes"));
});
test("retains original times when no outdoor window fits", () => {
  const a = { ...activity("All-day hike"), duration: "10 hours" };
  const r = planSchedule([a], defaults, forecast(), date);
  assert.equal(r.changes.length, 0);
  assert.match(r.issues[0], /Original time kept/);
});
test("without a forecast, outdoor moves pause but indoor conflicts can be resolved", () => {
  const { changes, issues } = planSchedule(
    [activity("Hike"), activity("Focus", "9:00 AM", "Indoors")],
    defaults,
    null,
    date,
  );
  assert.ok(changes.every((c) => c.type === "Indoors"));
  assert.ok(issues.some((i) => i.startsWith("Hike:")));
});
test("reports overlapping fixed commitments instead of promising a valid schedule", () => {
  const r = planSchedule(
    [
      activity("A", "9:00 AM", "Indoors", false),
      activity("B", "9:30 AM", "Indoors", false),
    ],
    defaults,
    forecast(),
    date,
  );
  assert.equal(r.changes.length, 0);
  assert.match(r.issues[0], /overlaps/);
});
test("respects selected planning hours", () => {
  const p = { ...defaults, planningHours: "9 AM–5 PM" };
  const r = planSchedule([activity("Run", "7:00 AM")], p, forecast(), date);
  for (const c of r.changes) {
    assert.ok(startMinute(c.after) >= 540);
    assert.ok(startMinute(c.after) + durationInMinutes(c.duration) <= 1020);
  }
});
test("does not schedule past dates or past time slots", () => {
  const r = planSchedule([activity("Run")], defaults, forecast(), "2000-01-01");
  assert.equal(r.changes.length, 0);
  assert.match(r.issues[0], /future date/);
});
test("validates malformed events", () => {
  assert.ok(activityError({ ...activity(""), name: "" }));
  assert.ok(activityError({ ...activity("A"), time: "25:00" }));
  assert.ok(activityError({ ...activity("A"), duration: "nonsense" }));
  assert.ok(activityError({ ...activity("A"), time: "11:30 PM" }));
});
test("calendar output preserves date, timezone, duration and escapes user text", () => {
  const a = {
    ...activity("A", "1:15 PM"),
    name: "Garden, then; rest\nOutside",
  };
  const ics = calendarFile([a], date, "America/Los_Angeles");
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20990101T131500/);
  assert.match(ics, /DTEND;TZID=America\/Los_Angeles:20990101T141500/);
  assert.ok(ics.includes("SUMMARY:Garden\\, then\\; rest\\nOutside"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

import { beforeEach, afterEach, vi, test, expect } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
const date = "2099-01-01";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          timezone: "America/Los_Angeles",
          hourly: {
            time: Array.from(
              { length: 24 },
              (_, h) => `${date}T${String(h).padStart(2, "0")}:00`,
            ),
            temperature_2m: Array(24).fill(20),
            precipitation_probability: Array.from({ length: 24 }, (_, h) =>
              h < 12 ? 80 : 5,
            ),
            weather_code: Array(24).fill(0),
            wind_speed_10m: Array(24).fill(10),
          },
          daily: {
            time: [date],
            temperature_2m_max: [20],
            temperature_2m_min: [12],
            precipitation_probability_max: [80],
            weather_code: [0],
          },
        }),
      }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function openPlan() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start planning" }));
  await screen.findByRole("heading", { name: "Today" });
  fireEvent.change(screen.getByLabelText("Planning date"), {
    target: { value: date },
  });
  await user.click(screen.getByRole("button", { name: "Plan", exact: true }));
  await user.click(
    screen.getByRole("button", { name: /Add another activity/ }),
  );
  return user;
}
test("creates and persists a plan, isolates dates, and reloads saved activities", async () => {
  const user = await openPlan();
  const name = screen.getByLabelText("Activity name");
  await user.clear(name);
  await user.type(name, "Garden watering");
  await user.click(screen.getByRole("button", { name: "Done" }));
  await user.click(screen.getByRole("button", { name: "Today", exact: true }));
  expect(await screen.findByText("Garden watering")).toBeTruthy();
  await waitFor(() =>
    expect(localStorage.getItem("fieldday.workspace.v1.local")).toContain(
      "Garden watering",
    ),
  );
  fireEvent.change(screen.getByLabelText("Planning date"), {
    target: { value: "2099-01-02" },
  });
  expect(screen.queryByText("Garden watering")).toBeNull();
  fireEvent.change(screen.getByLabelText("Planning date"), {
    target: { value: date },
  });
  expect(screen.getByText("Garden watering")).toBeTruthy();
  cleanup();
  render(<App />);
  await screen.findByRole("heading", { name: "Today" });
  fireEvent.change(screen.getByLabelText("Planning date"), {
    target: { value: date },
  });
  expect(await screen.findByText("Garden watering")).toBeTruthy();
});
test("reviews and accepts a weather-aware move without changing the plan beforehand", async () => {
  const user = await openPlan();
  const name = screen.getByLabelText("Activity name");
  await user.clear(name);
  await user.type(name, "Morning run");
  fireEvent.change(screen.getByLabelText("Start time for Morning run"), {
    target: { value: "09:00" },
  });
  await user.click(
    screen.getByRole("button", { name: "Indoors", exact: true }),
  );
  await user.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await user.click(
    screen.getByRole("button", { name: "Find my best schedule" }),
  );
  expect(await screen.findByText("After")).toBeTruthy();
  expect(screen.getByText("12:00 PM–12:30 PM")).toBeTruthy();
  expect(localStorage.getItem("fieldday.workspace.v1.local")).toContain(
    "9:00 AM",
  );
  await user.click(screen.getByRole("button", { name: "Accept change" }));
  await screen.findByRole("heading", { name: "Today" });
  await waitFor(() =>
    expect(localStorage.getItem("fieldday.workspace.v1.local")).toContain(
      "12:00 PM",
    ),
  );
});
test("weather and preference controls reflect live forecast and persist edits", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start planning" }));
  await screen.findByRole("heading", { name: "Today" });
  await user.click(
    screen.getByRole("button", { name: "Weather", exact: true }),
  );
  await screen.findByRole("heading", { name: "7-day forecast" });
  await user.click(screen.getByRole("button", { name: "You", exact: true }));
  await user.selectOptions(
    screen.getByLabelText("Outdoor rain threshold"),
    "60",
  );
  await user.selectOptions(screen.getByLabelText("Maximum outdoor wind"), "15");
  await waitFor(() => {
    const data = JSON.parse(
      localStorage.getItem("fieldday.workspace.v1.local")!,
    );
    expect(data.preferences.rainThreshold).toBe(60);
    expect(data.preferences.maxWind).toBe(15);
  });
});
test("weather errors leave planning usable and show an explicit retry", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("Offline"));
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Start planning" }));
  expect(await screen.findByText(/Live weather unavailable/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Plan", exact: true }));
  expect(
    screen.getByRole("heading", { name: "What’s in your day?" }),
  ).toBeTruthy();
});

# Fieldday

A working, responsive weather-aware planner built from your Figma Make export. Fieldday helps commuters, athletes, gardeners, outdoor enthusiasts and event planners fit flexible activities around the forecast without moving fixed commitments.

## Start here

1. Install **Node.js 24 LTS** from https://nodejs.org/.
2. Extract this ZIP and open a terminal in the folder containing `package.json`.
3. Run:

```sh
npm ci
npm run dev
```

4. Open the local address Vite prints. Select **Start planning**.

No API key, database, or account is required for device mode. You need an internet connection for live weather. Your plans and preferences survive refreshes in this browser. Nothing is pre-populated or signed into a pretend account.

## Put it in your existing GitHub repository

Extract the ZIP and upload the **contents of the Fieldday folder** to the root of your repo. Include `.github/workflows/deploy.yml`, `.env.example`, `src`, `public`, `supabase`, tests, and the package files. Some file pickers hide dotfiles, so check that `.github` appears in GitHub after uploading. Do not upload the ZIP itself as the app.

If using Git locally, copy the files into your existing checkout, review the changes, and commit/push. Keep your existing `.git` folder. Back up existing application files before replacing files with the same names.

### Publish with GitHub Pages

1. Use `main` as your default branch, or update the branch in `.github/workflows/deploy.yml`.
2. In GitHub, open **Settings → Pages → Source → GitHub Actions**.
3. Open **Actions → Deploy Fieldday to GitHub Pages → Run workflow** (or push to `main`).
4. Once successful, open the URL shown in the deploy job or Pages settings.

The workflow installs dependencies, runs the tests, builds, then deploys. Relative asset paths support both `username.github.io` and `username.github.io/repository-name/`. All navigation stays within the app; no server rewrite rules are needed. Pages hosting availability depends on your repo visibility and GitHub plan.

For Vercel, Netlify, or another static host: build command `npm run build`, output directory `dist`, Node 24. Build locally with `npm run build`, then `npm run preview` to serve the production bundle. Do not open `index.html` by double-clicking it.

## Using the app

- Pick a **planning date** at the top. Each date has its own activities.
- In **Plan**, add an activity, edit its name, start time and duration, choose **Indoors/Outdoors**, then select **Done**.
- Use the activity menu to edit or delete it. Turn **Flexible time** off for appointments that must stay in place.
- In **You**, set rain probability, comfortable temperature, wind speed, planning hours and the gap between events. Preferences save automatically; the Save button confirms them.
- Select **Find my best schedule**. Review the proposed moves and any events that could not be placed. Nothing moves until you select **Accept**.
- **Weather** shows hourly temperatures, rain probabilities and wind plus the seven-day forecast. A check mark means an hour fits your preferences.
- **Export selected day to calendar** downloads an `.ics` file you can import into Google, Apple or Outlook Calendar. This is a one-way export, not automatic calendar sync.
- **Download workspace backup** saves all dates and preferences. **Restore backup** validates the file and asks before replacing your workspace.

Supported forecast locations initially match the design: Portland, Seattle, San Francisco and New York. Forecasts are provided by Open-Meteo and refreshed every 15 minutes, with a manual refresh button. Forecasts older than 30 minutes do not drive outdoor suggestions. Weather outside the seven-day forecast horizon is unavailable. There is no fabricated weather fallback.

## How scheduling and AI work

The core scheduling engine is deterministic and works **without an AI key**. It searches 15-minute slots within planning hours. Outdoor slots must meet the user's rain, temperature and wind limits across the entire activity; thunderstorm codes are excluded. It respects fixed events, existing reservations, activity duration and buffers. It prioritizes outdoor activities and minimizes disruptive moves while favoring lower rain probabilities. It reports unplaceable activities and keeps their original time. It does not shorten activities, silently relax preferences, or move plans without approval.

This is a conservative planning heuristic, not a globally optimal scheduling solver. If no suggestion fits, try another date, adjust your preferences or move a fixed event yourself. Rain probability and predicted wind cannot guarantee safe outdoor conditions.

The **AI coach** is a real, optional OpenAI integration implemented as a Supabase Edge Function. It explains the validated proposals using the selected day's forecast, activities and preferences. It never writes to your calendar or changes a schedule. The planner does not label ordinary scheduling logic as a live AI model. Without a configured backend/key, the UI clearly says the coach is not connected; there are no canned answers pretending to be AI responses.

## Optional: real accounts and cloud storage

You can add these now or later. Local mode continues to work without them.

1. Create a Supabase project at https://supabase.com/.
2. Open **SQL Editor** and run `supabase/migrations/202611120001_fieldday.sql` **once**. It creates owner-only workspace policies and a 20-requests-per-user-per-day AI rate limit.
3. In **Authentication → Providers**, enable email/password. Configure a production SMTP provider for reliable confirmation/reset emails if your use case needs it.
4. In **Authentication → URL Configuration**, set Site URL to your full published app URL. Add the exact app URL (including the repository path and trailing slash on GitHub Pages), and your local development URL if needed, to allowed redirect URLs.
5. Copy `.env.example` to `.env.local` and fill in:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

6. Restart `npm run dev`. You will see real sign-up, sign-in, password reset and a device-mode option.
7. For GitHub Pages, put these two values in **Settings → Secrets and variables → Actions → Variables** with the same names, then rerun the deployment. These are public browser configuration values. **Never use a Supabase service-role key.**

Account mode stores one workspace per user under row-level security. Device mode uses a separate local workspace. Device plans do not silently move into a newly created account; export a backup in device mode and restore it after signing in if you want to transfer them. Workspaces are not collaborative. Cloud writes use last-write-wins semantics across devices; avoid editing the same account simultaneously on two devices. Local changes that fail to sync are retained for retry. Export backups before clearing browser storage or signing out with unsynced edits.

## Optional: enable the AI coach when your API key is ready

Prerequisite: complete the Supabase setup above, including the database migration. The frontend never needs the OpenAI key.

1. Install the Supabase CLI using its official guide: https://supabase.com/docs/guides/cli/getting-started.
2. From the project folder:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REFERENCE
supabase functions deploy weather-coach
```

3. In the Supabase dashboard, open **Edge Functions → Secrets** and add **`OPENAI_API_KEY`**. Enter the key there, never in a source file, GitHub upload, or `VITE_` variable. The function automatically has access to Supabase's project URL and anon key.
4. Optional: set the server secret `OPENAI_MODEL` to a supported chat-completions model. Default: `gpt-4.1-mini`.
5. Sign into an account in Fieldday, add activities, open **Find my best schedule**, then select **Explain with AI**.

No frontend code change or rebuild is needed when you add the server API key. OpenAI billing must be enabled. Requests include the selected date's forecast, preferences and activity names; do not put secrets in activity names. The function authenticates the user with Supabase before making any AI request, enforces a daily quota, rejects stale forecasts, and keeps the key server-side. With an unset key it returns an explicit not-connected error; normal scheduling remains available.

The edge function validates JWTs with `auth.getUser()` inside the function (`verify_jwt = false` in `supabase/config.toml` supports current signing keys). This does not grant unauthenticated AI access.

## Development and validation

```sh
npm test
npm run build
npm run preview
```

- `src/App.tsx`: planner, review, preferences, auth coordination.
- `src/planner.ts`: scheduling, forecast API, calendar export, validation.
- `src/Weather.tsx`: weather views and hourly preference checks.
- `src/Auth.tsx`: real account and device-mode entry.
- `src/services.ts`: browser persistence, cloud storage, backup validation.
- `src/ai.tsx`: optional AI coach UI.
- `supabase/functions/weather-coach/index.ts`: authenticated server AI integration.
- `supabase/migrations/`: database and security policies.
- `.github/workflows/deploy.yml`: build, test and Pages deployment.

The 18 automated tests cover parsing, scheduling constraints, full-duration forecast checks, missing weather, fixed-event conflicts and calendar export, plus DOM interaction tests for activity creation, persistence, date isolation, review/approval and preferences. Production TypeScript/build checks and the live weather endpoint were verified during handoff. Interactive browser QA was unavailable in the build environment. Supabase accounts, email delivery, cloud policies and the OpenAI call are implemented but require testing against your configured services before a public launch. This delivery is a working standalone web app with an optional backend, not an already provisioned SaaS service.

## Troubleshooting

- **Blank Pages site:** check the Actions run, make sure files are at the repo root, Node 24 is used, and Pages Source is GitHub Actions.
- **Forecast unavailable:** check your connection or Open-Meteo availability, use Refresh, and select a date within the next seven days. Outdoor moves pause instead of using invented data.
- **No suggested changes:** your current slots may fit already, activities may be fixed, or the notices explain why no valid window fits. Rain/temperature/wind preferences can be deliberately strict.
- **Cloud save failed:** confirm the migration ran, use the public project key, then select Retry cloud save in You. Export a backup before clearing storage.
- **Confirmation/reset link fails:** check Supabase redirect URLs and email settings. Use the exact host/path where your app is deployed.
- **AI unavailable:** deploy the function, add its server secret, run the migration and sign in. Check Edge Function logs and OpenAI billing/model access. Provider keys and raw provider error bodies are never displayed by the function.

The supplied SVG artwork and Fieldday visual design are retained from your upload. Fonts are bundled locally under the SIL Open Font License; license notices are in `public/fonts/`. No Figma runtime, Figma account, or Figma-specific scripts are required.

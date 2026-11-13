import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    include: ["tests/*.test.tsx"],
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  },
});

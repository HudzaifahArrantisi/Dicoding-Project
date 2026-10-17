import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";
import { env } from "@/env";
import { supabase } from "./supabase";

export const api = treaty<App>(env.VITE_API_URL, {
  async onRequest() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  },
});

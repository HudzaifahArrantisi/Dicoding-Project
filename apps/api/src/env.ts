const required = ["DATABASE_URL", "SUPABASE_URL", "WEB_ORIGIN"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Env ${key} belum diisi di apps/api/.env`);
  }
}

export const env = {
  PORT: Number(process.env.PORT ?? 3001),
  DATABASE_URL: process.env.DATABASE_URL!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ?? "",
  WEB_ORIGIN: process.env.WEB_ORIGIN!,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
};

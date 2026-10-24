const required = ["DATABASE_URL", "WEB_ORIGIN"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Env ${key} belum diisi di apps/api/.env`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3001),
  DATABASE_URL: process.env.DATABASE_URL!,
  WEB_ORIGIN: process.env.WEB_ORIGIN!,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
};

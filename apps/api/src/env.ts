const required = ["DATABASE_URL", "SUPABASE_URL", "WEB_ORIGIN"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Env ${key} belum diisi di apps/api/.env`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3001),
  DATABASE_URL: process.env.DATABASE_URL!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.SUPABASE_JWT_SECRET ?? "",
  WEB_ORIGIN: process.env.WEB_ORIGIN!,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
};

declare global {
  var Bun: {
    password: {
      hash(password: string): Promise<string>;
      verify(password: string, hash: string): Promise<boolean>;
    };
  };
}

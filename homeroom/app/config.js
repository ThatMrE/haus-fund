// Homeroom — Supabase connection.
//
// Fill these in from Supabase → Project Settings → API, then commit.
//
// The anon key is designed to be public: it identifies the project, it does
// not grant anything. Every rule that matters is enforced by row-level
// security and the SECURITY DEFINER functions in supabase/schema.sql, so a
// reader of this file gains nothing they could not get by signing up.
//
// The service_role key is the opposite of that. It bypasses row-level
// security entirely. It must never appear in this repo or in any file the
// site serves.

export const SUPABASE_URL = 'https://REPLACE-ME.supabase.co';
export const SUPABASE_ANON_KEY = 'REPLACE-ME';

export const isConfigured = () =>
  !SUPABASE_URL.includes('REPLACE-ME') && !SUPABASE_ANON_KEY.includes('REPLACE-ME');

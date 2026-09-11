import "server-only";
import { createClient } from "@supabase/supabase-js";

// -- URL dan key diambil dari environment variable --
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// -- Client untuk operasi publik (read-only aman) --
export const supabase = createClient(supabaseUrl, supabaseAnon);

// -- Client dengan service role — HANYA dipakai di server/API routes --
// Jangan pernah expose ini ke browser!
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://hhcexivlaqjeuvnzeqnn.supabase.co';
const fallbackSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJoaGNleGl2bGFxamV1dm56ZXFubiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgxMjQyNTEwLCJleHAiOjIwOTY4MTg1MTB9.nVwKyd_BITZ9SU4LQHXkb89ndUM7O_DGd6ESJx282B0';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

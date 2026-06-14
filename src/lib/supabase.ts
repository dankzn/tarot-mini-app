import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hhcexivlaqjeuvnzeqnn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY2V4aXZsYXFqZXV2bnplcW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDI1MTAsImV4cCI6MjA5NjgxODUxMH0.nVwKyd_BITZ9SU4LQHXkb89ndUM7O_DGd6ESJx282B0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
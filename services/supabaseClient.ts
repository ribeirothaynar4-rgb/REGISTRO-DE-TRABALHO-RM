import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xpnbzyolmsypryckhwuz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwbmJ6eW9sbXN5cHJ5Y2tod3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNzY1MTQsImV4cCI6MjA3OTk1MjUxNH0.Od8hR44HUfGMtn21GqsIJdMh0o7bJ4gEsd_ASOycWXY';

export const supabase = createClient(supabaseUrl, supabaseKey);
/* SoFitGo — cloud accounts switch (beta)
   Empty values (default) = the app keeps all data on this device only; no account screens.
   To turn on accounts: Supabase dashboard → Project Settings → API Keys. Copy the Project URL and the PUBLISHABLE key
   (starts with sb_publishable_). Paste both below, save, and redeploy this folder.
   Paste ONLY the publishable key — never any other key (e.g. service_role): this file is public. The app ignores other keys, but they would still be exposed.
   Before turning this on, the database migration must be applied (see docs/SUPABASE-MIGRATION-REVIEW.md). */
window.SOFITGO_CONFIG = { supabaseUrl: 'https://dvrfzeojctnttdkznuqr.supabase.co', publishableKey: 'sb_publishable_ExImhx9X6y5Y9U6QWjvV7Q_zl5mH-5m' };

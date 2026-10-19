Android (Health Connect) — additions after `npx cap add android`:
1. The plugin manifest already declares read permissions for basic types (per the plugin README, v8.7.0).
2. Health Connect REQUIRES a privacy policy: either an HTML file in android/app/src/main/assets or the string
   resource `health_connect_privacy_policy_url`. A draft is in ../privacy-policy-draft.html — the owner must
   review/approve it (not legal advice) and decide where it is hosted.
3. Do NOT add READ_HEALTH_DATA_HISTORY unless older than ~30 days of history is needed (it is not, for now).
4. Google Play: health permissions need a declaration form in Play Console before release (owner account).

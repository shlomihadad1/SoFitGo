# TEST RESULTS — M10.3 · build `ed67b2a8f3`

`sh tools/run_all.sh` on commit ba9e79d: **49/50 suites passed.** The one failure, `build_check` ("no secrets in build"), flagged the new CSS selector `input[type=password]`. Fixed with an exact allow-list in commit f786523; the build is unchanged. After the fix: `build_check` 146/146 and `rc1_final_test` 26/26, and injected secrets are still caught. Full log: `TEST-LOG-M10.3-ed67b2a8f3.txt`.

Real server (dvrfzeojctnttdkznuqr): a rate-limited sign-up returns 429 `over_email_send_rate_limit` and creates no user; `live_check` part 1 passed 7/7 (on M10.2).

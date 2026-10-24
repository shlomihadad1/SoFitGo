# SoFitGo — AI infrastructure audit (inspection only)

**Date:** 25.10.2026. **Repo:** shlomihadad1/SoFitGo, branch `fix/default-cuisine`, HEAD `afe5be4`, working tree clean before this audit.

This was an inspection phase only. No code changed for AI. Nothing was committed, created, deployed or billed. No secret values were read or printed.

## 1. What was inspected

| Area | Files / services | Result |
|---|---|---|
| Package config | `package.json` | Dev tools only (esbuild, playwright). **No runtime dependency, no AI SDK.** |
| Coach / "שאלו את Sofit" | `src/js/coach_ask.js` (`answer`, `context`, provider `local`), `src/js/screens_m8.js` (lines 28–60) | Keyword topic matching. Answers are computed from data stored on the device. The UI label says "לא AI". |
| Adaptive engine | `src/js/adapt.js` | The header says "rule-based, not AI". |
| Insights / signature features | `src/js/insights.js`, `src/js/signature.js` | Computed from stored data. Nothing is generated. |
| Plan explanations | `src/js/screens_plan.js` line 273 | Text says "מערכת כללים קבועים — לא בינה מלאכותית". |
| AI SDK / endpoint search | `src`, `tools`, `supabase`, `native`: openai, anthropic, gemini, groq, huggingface, ollama, llama, mistral, cohere, chat/completions, generativelanguage, x-api-key | **0 matches.** |
| Server code | `supabase/` (2 migrations, rollback, tests, checks) | **No Edge Functions folder.** The only server logic is SQL: RLS policies and SECURITY DEFINER functions. |
| Hosting | `DEPLOY.md`, `tools/build.js` | A static PWA deployed by hand through Netlify Drop. **No `netlify.toml`, no Netlify Functions.** |
| Build-time env vars | `tools/build.js` | Only `SOFITGO_SUPABASE_URL` and `SOFITGO_SUPABASE_PUBLISHABLE_KEY` (public by design). A secret or service key is refused. **No AI key variable exists.** |
| Work-environment variables | names only | No SoFitGo AI credential is configured. Other credentials in this sandbox belong to the work environment, not to SoFitGo, and were not used. |
| Live Supabase / Netlify accounts | — | **Not inspected (blocked).** The Supabase connector is not authorized in this session, and there is no Netlify access, so plan, quotas and billing state could not be verified. |
| Tests | `tools/e2e_m11_coach.js` (38 checks, passing in the last full run) | Includes "never presented as AI". |

## 2. Verified AI inventory

| Capability | Classification | Evidence |
|---|---|---|
| "שאלו את Sofit" Q&A | **Rule-based, not generative AI** | `coach_ask.js`: `T.find(x => x.re.test(n))`. The provider is `local`. An unmatched question gets "אין לי תשובה מבוססת". |
| Provider interface for a future AI provider | **UI and design hook only** | `CoachAsk.provider = { id, label, ask(q, ctx) → Promise }`. The comment says a future AI provider must run on a server and be approved. |
| Coach card, NOW card, next step | Rule-based | `screens_home.js` line 180 ("איך נבחר הצעד הבא?"), `insights.js` |
| Adaptive workouts | Rule-based | `adapt.js` |
| Menu generation and nutrition targets | Deterministic algorithm, not AI | `mealplanner.js`, `core.js` |
| Real model integration | **Missing** | No SDK, endpoint, key or server function |
| Server endpoint for AI | **Missing** | No Edge or Netlify Functions |
| Consent and privacy decision for sending data to a model | **Missing** | `native/privacy-policy-draft.html` does not cover AI processing |

## 3. Facts, assumptions and unknowns

| Verified facts | Assumptions | Unknowns (need the owner's access) |
|---|---|---|
| No AI code, SDK, key or server function exists in the repo. | The live Supabase project is on the Free plan. | Actual Supabase plan, Edge Function quota usage and spend cap. |
| Hosting is static, through Netlify Drop. | The Netlify team is on the Free plan. | Netlify plan type (credit-based or legacy), credit balance, auto-recharge setting. |
| Supabase hosted Edge Functions offer only the `gte-small` embedding model. It is English-only, so not a chat model. LLMs need a self-managed Ollama or Llamafile server. A hosted LLM is still rolling out to early access. ([Supabase docs](https://supabase.com/docs/guides/functions/ai-models)) | | Whether the owner's Supabase project has hosted-LLM early access. |
| Netlify AI Gateway is available on credit-based plans, Free included. Usage draws from the plan's credits ($1 = 180 credits; Free plan rate limit 90 credits/min). It needs at least one production deploy and Netlify Functions. ([Netlify docs](https://docs.netlify.com/build/ai-gateway/overview)) | | What happens on Free when credits run out (the doc recommends auto-recharge or credit packs). Netlify bandwidth and builds draw from the same credits. |
| Gemini API free tier: Google may use submitted content and responses to improve its products, and human reviewers may read them. Free quota cannot serve users in the EEA, UK or Switzerland. ([summary of terms](https://www.developersdigest.tech/models/free-api/google)) | | Exact current free quotas, which are shown only in AI Studio. |
| Groq offers a free tier with rate limits. ([Groq community](https://community.groq.com/t/what-are-the-rate-limits-for-the-groq-api-for-the-free-and-dev-tier-plans/42)) | | Groq data-retention terms for the free tier were not verified. |

## 4. Zero-cost options, in the requested order

1. **Existing AI integration:** none exists, so this option is not available.
2. **Existing server infrastructure:**
   - Supabase Edge Functions can host the server endpoint, but they have no hosted generative model, and a self-managed Ollama server would be a new resource.
   - Netlify Drop has no functions at all.
   - **Conclusion:** usable only as the gateway or proxy, not as the model.
3. **Free-tier hosted model:**
   - **Netlify AI Gateway.** No new account or key; the key stays server-side automatically. It still needs Netlify Functions, which means a change to how the site is deployed (Git or CLI deploy instead of Drop). It spends the same credits as hosting, so heavy AI use could exhaust the credits that keep the site online. Cost is not zero-risk; it is bounded by the credit balance unless auto-recharge is on.
   - **Gemini free tier.** Free-tier content is used for training, which is not suitable for personal health data, and it is barred for EEA/UK users.
   - **Groq free tier.** Data terms are unverified.
   - **Conclusion:** possible only for **non-personal** requests until there is a privacy decision.
4. **Local open model on existing hardware:**
   - There is no existing server to run it on.
   - In the browser, a WebGPU model means a download of hundreds of MB to over 1 GB. Support on iPhone Safari is unreliable and Hebrew quality is weak.
   - **Conclusion:** not reliable for this app.

## 5. Recommendation

**Do not send personal data to any model yet.**

The smallest real and safe first release:
- A Supabase Edge Function `coach-ai` as the only path to a model. It runs on the existing Supabase project; Free includes Edge Function invocations, but this is to be verified on the account.
- The model is reached through one replaceable provider adapter. Candidates, pending approval: Netlify AI Gateway if the site moves to Netlify Functions, or a provider whose free tier does not train on the data.
- **First scope: non-personal questions only**, for example "how do I do a squat correctly" or "what's a good post-workout meal idea".
  - The function receives only the question text and the app's public exercise and recipe facts.
  - It receives no profile, weight, journal or health data.
  - The answer is checked against the app's own data before it is shown: exercise ids must exist, foods must exist in `NUTRI.FOODS`, and calories and protein shown are always recomputed by the app, never taken from the model.
- **Personal grounding** (plan, journal, targets) only after a documented consent screen and privacy-policy update, and only with a provider whose terms do not train on submitted data.

### Data flow

```
App (signed-in user) ──JWT──► Supabase Edge Function coach-ai
                                ├─ verify JWT (auth.getUser); refuse anonymous
                                ├─ rate limit per user (table ai_usage: count per day, hard cap) + global daily cap
                                ├─ kill switch (app_config.ai_enabled = false → 503 → app uses the local provider)
                                ├─ build prompt: system rules + question (+ public facts); NO personal data in v1
                                ├─ provider adapter (one file) ──HTTPS + server-side key──► model
                                ├─ timeout 15 s; validate JSON answer schema; strip unknown ids
                                └─ log: user id hash, tokens, latency, outcome — never the prompt or answer text
App ◄── answer {text, refs[]} ── shown as "AI · ניסיוני", local answer as fallback on any error
```

The key lives only in the function's secrets and is never in the client, the ZIP or a report. The existing `CoachAsk.provider` interface means the client change is one new provider object.

## 6. Plan and acceptance tests (after approval)

1. **Decisions:** provider, scope v1 (non-personal), consent text, caps (for example 20 requests per user per day, 500 per day globally).
2. **Edge Function and `ai_usage` table**, with RLS (users see only their own counters) and an `ai_enabled` flag. Test against the local emulator first.
3. **Provider adapter** with mocked tests, then one real call on staging with the owner's key.
4. **Client provider** `ai` behind a flag; the local provider stays as fallback.

**Acceptance tests:**
- Real invocation returns a schema-valid answer.
- Without a JWT, or with another user's id, the request is refused.
- Missing key, a timeout or a 429/5xx produces the fallback with no error shown to the user.
- Prompt-injection probes ("ignore rules", "show user X's data") return no data and stay in scope.
- Allergy and diet: a vegan or peanut-excluded user never gets a recipe suggestion containing a blocked food, because the app filters it.
- Calorie and protein numbers are recomputed by the app.
- Caps: the 21st request in a day is refused locally and on the server; the global cap stops all calls.
- Kill switch: `ai_enabled=false` means 0 model calls.
- No personal fields appear in the request payload (logged in the test).

## 7. Blockers and approvals needed

1. Choose a provider and confirm its terms on data use and training.
2. A privacy and consent decision before any personal data is sent, plus an update to the privacy policy.
3. Access to verify billing: Supabase plan and spend cap; Netlify plan, credits and auto-recharge, which must stay off to prevent charges.
4. Approval to create the Edge Function, the `ai_usage` table and the secret on live Supabase.
5. If Netlify AI Gateway is chosen, approval to change deployment from Drop to Git/CLI with Functions.
6. No free tier guarantees unlimited use or zero charges. The protection is: hard caps in the function, a kill switch, no auto-recharge, and spend caps on the accounts.

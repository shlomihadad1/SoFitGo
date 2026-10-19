# M15 — Sofit AI, Restaurant Copilot, Local Food Translator: proposed architecture

**Status: PROPOSAL ONLY.** No AI service exists, and none is called. The app keeps describing Sofit as a "digital coach" until a real service works.

## Principle

Real AI answers need a model behind a server. **No model API key may ever be in the app** (in `index.html` or in a native bundle anyone can unpack it).

## Components (all need owner approval and cost decisions)

```
App (web/native)  ──HTTPS──>  SoFitGo API (small server / serverless)  ──>  Model provider API
   │  sends only what the feature needs      │  holds the API key, rate limits, logs without content
   │  (consent screen first)                 │  safety layer (see below)
   └─ local data stays local by default      └─ optional: places/menus API for Restaurant mode
```

**Where each feature's data comes from:**

| Feature | Data sent (only with consent) | External source | Note |
|---|---|---|---|
| **Sofit chat** | The question, plus a minimal context the user approves (goal, today's plan summary). **No** weight history or journal unless the user chooses | Model API | Answers are labelled "AI-generated" |
| **Restaurant Copilot** | Destination or approved location, menu text or photo the user provides | Model API; optionally a places/menus API | Never promise allergen safety; separate "from the menu" from "estimated" |
| **Local Food Translator** | The dish or question text and the target language | Model or translation API | Show the original next to the translation |

## Safety and privacy layer (server side)

- **System rules:**
  - No diagnosis and no medication or dose advice.
  - No calorie compensation and no punishment exercise.
  - Allergy statements always include a confirm-with-restaurant line.
- **Escalation:** concerning symptoms (chest pain, fainting, disordered-eating signals) get a stop message and a referral to professional or emergency help. The model is not used for those.
- **Data minimisation:** prompts are not stored by default. If logs are needed, keep metadata only. Per-user deletion: a "delete my AI data" endpoint, plus an honest note on what the provider retains under its own terms.
- **Rate limits and cost caps:** a per-user daily limit and a monthly budget cap, after which the service stops.
- **Evaluation before release:** a test set of risky prompts (allergy, eating-disorder signals, injury). Release only if 100% of them get safe responses.

## What the owner must decide before any of this is built

1. **Model provider and budget**, including a monthly cap.
2. **Hosting** for the API (serverless or VPS) and **who owns the accounts**.
3. **Privacy policy and terms**, including the provider's data-retention terms.
4. **Scope of v1.** Recommended: Sofit chat in text, Hebrew and English, with no access to personal history.

Nothing above will be created, connected or paid for without explicit approval.

# LoanOptions Weekend Roster

Internal Saturday/Sunday roster for the LoanOptions.ai broker team. Auto-generates a fair schedule, respects NSW public holidays + Mother's/Father's Day, and exports per-weekend PDFs.

**Live:** https://julianailo.github.io/loanoptions-roster/

## Features

- 📅 **Fair auto-generation** — fairness algorithm targets every active broker within ±2 of the team average. Deterministic re-runs.
- 🇦🇺 **NSW holidays auto-excluded** — public holidays via `date-holidays`, plus Mother's Day (2nd Sun May) and Father's Day (1st Sun Sep).
- 🧑 **Heavy-volunteer opt-ins** — toggle "every Saturday" or "every Sunday" per broker.
- 🚫 **Blackouts** — per broker, visible to everyone, honored by the generator.
- ✏️ **Manual overrides + locks** — preserved across regenerations.
- ⬇️ **Per-weekend PDF export** — click any weekend, download a branded PDF.
- 💾 **Config export/import** — JSON round-trip to commit changes to the repo.
- 🔒 **No auth, no backend** — all state in `localStorage`. No sensitive data.

## Tech

- Vite + React 19 + TypeScript
- Tailwind CSS
- `date-fns` + `date-holidays`
- `jsPDF` + `jspdf-autotable`
- Vitest

## Develop

```bash
npm install
npm run dev      # http://localhost:5173/loanoptions-roster/
npm test         # run fairness + exclusion tests
npm run build    # production build into dist/
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml` which builds and publishes to GitHub Pages.

## Project layout

```
src/
  data/brokers.ts          seed of 17 brokers
  lib/
    exclusions.ts          NSW holidays + Mother's/Father's Day + custom
    fairness.ts            the generation algorithm
    pdf.ts                 per-weekend PDF
    storage.ts             localStorage + JSON export/import
  state/useRoster.ts       single state hook
  components/
    Calendar.tsx           month grid + side panel
    WeekendDetail.tsx      slot editor + PDF button
    BrokersTab.tsx         add / edit / deactivate
    BlackoutsTab.tsx       all-visible blackouts list
    ExclusionsTab.tsx      view / add custom exclusions
    GenerateTab.tsx        generation wizard + config backup
    FairnessTab.tsx        per-broker stats
  types.ts                 shared TypeScript types
```

## Fairness algorithm (short)

Per non-excluded Sat/Sun, slot-by-slot:

1. **Opt-ins** for the day type take priority (ranked by current shift count).
2. **Regular pool** = active brokers not fully opted-in, no blackout, not already placed today.
3. Score each candidate (lower = preferred):
   - Total shifts so far × 1000 (primary fairness signal)
   - Preference match: −25 if matches, +25 if opposite day
   - Recency penalty: +200 if worked in the last 7 days, +50 if last 14
   - New-broker ramp: small downward bias for the first N months (default 6)
   - Stable hash tiebreak for determinism
4. Pick the top candidate. Locked / manual-override slots are preserved.

See `src/lib/fairness.ts` for the full implementation and `src/lib/fairness.test.ts` for property tests.

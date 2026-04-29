# Slide 5 — Process Flow

```
Upload CSV / Demo Dataset
        ↓
Standard Audit (AIF360)  →  PASSES ✓  ← the deception
        ↓
Causal Graph (DoWhy)
        ↓
Proxy Path Detection  →  3 paths found ✗
        ↓
Impossibility Surface  →  17-step threshold sweep
        ↓
[Optional] Surgical Debiasing  →  65.4% bias reduction
        ↓
Gemini AI Report  →  plain language for HR director
```

**Key use case:**
HR Director uploads hiring data → Aition finds 3 proxy paths standard tools missed → Gemini explains impact to the board in plain English.

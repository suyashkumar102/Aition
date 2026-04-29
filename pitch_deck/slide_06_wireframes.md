# Slide 6 — Wireframes

**Two-verdict layout — the core visual argument:**

```
┌─────────────────┐     ┌─────────────────┐
│  Standard Audit │     │  Causal Audit   │
│  ✓  FAIR        │ vs  │  ✗  NOT FAIR    │
│  DPD: 0.0809    │     │  3 proxy paths  │
│  Passes test    │     │  81 affected    │
└─────────────────┘     └─────────────────┘
      GREEN                    RED
```

**Dashboard sections:**
- Alert banner — affected count + verdict
- Causal graph — colour-coded SVG (purple=protected, red=proxy, green=legitimate)
- Impossibility slider — live DPD / EOD / accuracy at each threshold
- Debiasing panel — before/after bias score and accuracy
- Report section — Gemini markdown rendered inline

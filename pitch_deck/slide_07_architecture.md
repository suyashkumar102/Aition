# Slide 7 — Architecture

```
React Frontend (Vercel)
        ↕ HTTP / JSON
FastAPI + Uvicorn
  ├── Causal Audit Engine    (DoWhy, PC algorithm)
  ├── Standard Fairness      (AIF360)
  ├── Debiasing Engine       (sklearn + reweighting)
  └── Report Generator       (Gemini 2.5 Flash)
        ↕
Data Layer
  └── demo_hiring_dataset.csv + in-memory audit cache
```

**Two endpoints:**
- `POST /audit` — full pipeline, returns audit_id
- `POST /audit/{id}/debias` — surgical debiasing on cached result

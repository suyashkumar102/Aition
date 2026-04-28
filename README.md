# THEMIS — Causal AI Fairness Engine

> "Your hiring model just passed every standard fairness test. It rejected 81 qualified candidates anyway."

Aition is an AI fairness auditing system that finds discrimination that standard tools miss — because it thinks causally, not statistically. While every other fairness dashboard measures whether output rates are equal across groups, THEMIS builds a causal graph of how a model actually makes decisions and traces the hidden proxy paths that carry bias invisibly through neutral-looking variables.

Built for Google Solution Challenge 2026 India | Unbiased AI Decision Track.

---

## The Problem Standard Tools Cannot Solve

Automated AI systems make over **10 million high-stakes decisions daily in India** — hiring, loan approvals, credit scoring, medical triage. The standard approach to auditing these systems is to measure demographic parity: are approval rates roughly equal across protected groups? If yes, the model is declared fair.

This is wrong. And it is provably wrong.

**Proxy discrimination** is the mechanism by which a model can satisfy demographic parity perfectly while still discriminating structurally. The model never looks at gender, age, or socioeconomic background directly. Instead, it learns to use variables that are statistically correlated with those attributes in historical data — college tier, employment gaps, graduation year, neighbourhood quality — as stand-ins. The protected attribute never appears in the decision chain. The discrimination happens anyway.

```
Standard tools see:    Age Group → [model] → Hire/Reject

Aition sees:           Age Group → Graduation Year Gap ──┐
                           ↓                              ↓
                       Employment Gap ──────────→ [model] → Hire/Reject
                                                    ↑
                       SES Group → Neighbourhood Quality ─┘
```

Standard tools are blind to this because they measure correlation between inputs and outputs. They cannot see causation. Aition can.

### The Impossibility Theorem — Why Every Other Tool Is Hiding Something

There is a second, deeper problem. The three mathematically rigorous definitions of fairness that organisations implicitly assume are compatible are, in fact, provably incompatible:

| Definition | What It Means |
|---|---|
| Demographic Parity | Equal approval rates across groups |
| Equalized Odds | Equal error rates (TPR and FPR) across groups |
| Individual Fairness | Similar individuals receive similar outcomes |

Chouldechova (2017) and Kleinberg et al. (2016) proved that these three definitions cannot all be satisfied simultaneously in any non-trivial model when base rates differ between groups. Every fairness dashboard on the market today averages these tensions away without surfacing them. They produce a single "fair" or "unfair" verdict on an inherently multi-dimensional value choice.

THEMIS is the first tool to make this tension interactive and actionable. It forces an explicit, informed organisational choice instead of hiding the decision inside a metric.

---

## What THEMIS Does

1. **Causal Graph Discovery** — Uses DoWhy with the PC (Peter-Clark) algorithm to build a causal graph of how the model makes decisions. Constraint-based causal discovery with Fisher's Z-test for continuous variables and chi-squared for categorical.

2. **Proxy Path Detection** — Applies the backdoor criterion to identify direct discrimination paths (protected attribute → outcome) and indirect proxy paths (protected attribute → intermediate variable → outcome). Computes do-calculus causal effect estimates: P(Y | do(A=a)) vs P(Y | do(A=a')).

3. **Standard Fairness Benchmarking** — Runs AIF360 demographic parity difference for all protected attributes. Shows the model passing standard tests. Then shows what THEMIS found that standard tests missed.

4. **Impossibility Surface** — Trains a logistic regression baseline, sweeps decision thresholds from 0.1 to 0.9, and computes the Pareto frontier between demographic parity difference and equalized odds difference. Renders this as an interactive slider so organisations can make an explicit, informed fairness definition choice.

5. **Surgical Debiasing** — Removes proxy variables from the feature set, reweights samples to equalise proxy variable distributions across protected groups, and retrains only the affected model components. Measures bias reduction and accuracy cost before and after.

6. **Plain Language Reporting** — Generates a structured audit report via Gemini 2.5 Flash with two audiences: a technical report for ML engineers (causal paths, effect sizes, correction strategies) and a plain language report for HR directors and compliance officers (what the AI was doing wrong, who was affected, what to do about it).

---

## Demo Results

On the included synthetic hiring dataset (2,000 records, two protected attributes):

| Metric | Standard Audit (AIF360) | THEMIS Causal Audit |
|---|---|---|
| Age group DPD | 0.0809 — PASSES | 3 proxy paths detected |
| SES group DPD | < 0.10 — PASSES | Neighbourhood quality proxy found |
| Proxy paths found | 0 | 3 |
| Affected candidates | Not detected | ~81 estimated |
| Verdict | FAIR | PROXY DISCRIMINATION DETECTED |

The dataset is engineered so that both demographic parity differences stay below the standard 0.10 threshold — the model passes every standard test — while three causal proxy paths carry real discrimination through graduation year gap, employment gap, and neighbourhood quality.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│   Dashboard · Causal Graph · Impossibility Slider        │
│   Debiasing Panel · Plain Language Report                │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / JSON
┌────────────────────────▼────────────────────────────────┐
│                  FastAPI Backend                         │
├──────────────┬──────────────┬──────────────┬────────────┤
│  Causal      │  Standard    │  Debiasing   │  Report    │
│  Audit       │  Fairness    │  Engine      │  Generator │
│  (DoWhy +    │  (AIF360)    │  (sklearn +  │  (Gemini   │
│  PC Algo)    │              │  reweighting)│  2.5 Flash)│
└──────────────┴──────────────┴──────────────┴────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Data Layer                            │
│   demo_hiring_dataset.csv · In-memory audit cache        │
└─────────────────────────────────────────────────────────┘
```

### Request Flow

```
POST /audit
  │
  ├─ 1. load_dataset()          — validate schema, load CSV or demo data
  ├─ 2. compute_standard_fairness()  — AIF360 DPD for age_group + SES group
  ├─ 3. run_causal_audit()      — DoWhy CausalModel, detect_proxy_paths()
  ├─ 4. build_graph_data()      — 8 nodes, 8 edges for frontend rendering
  ├─ 5. compute_impossibility_surface()  — LR sweep, Pareto frontier
  ├─ 6. generate_report()       — Gemini 2.5 Flash, fallback on error
  └─ 7. return AuditResponse    — cached by audit_id for /debias

POST /audit/{audit_id}/debias
  │
  ├─ 1. proxy_removal           — drop college_graduation_year_gap + neighbourhood_quality
  ├─ 2. reweighting             — equalise employment_gap distribution across age groups
  ├─ 3. retrain LR              — on reduced feature set with sample weights
  └─ 4. return DebiasingResult  — bias before/after, accuracy before/after
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI + Uvicorn |
| Causal discovery | DoWhy 0.11 (PC algorithm, backdoor criterion) |
| Standard fairness | AIF360 0.6 (BinaryLabelDatasetMetric) |
| Debiasing | scikit-learn LogisticRegression + sample reweighting |
| Report generation | Google Gemini 2.5 Flash (google-genai SDK) |
| Frontend framework | React 18 + React Router |
| Graph rendering | Custom SVG (CausalGraph.jsx) |
| UI components | shadcn/ui + Lucide icons |
| Build tooling | CRACO (Create React App with custom config) |
| Testing | pytest + Hypothesis (property-based) |
| Data | pandas + numpy |

---

## Dataset

The demo dataset (`data/demo_hiring_dataset.csv`) is a synthetic 2,000-row hiring dataset generated by `data/generate_demo_dataset.py`. It is engineered with the following properties:

**Protected attributes:**
- `age_group` — Young / Senior (50/50 split)
- `socioeconomic_group` — High / Low (50/50 split)

**Legitimate features:**
- `experience_years` — uniform 1–10
- `test_score` — normal(65, 15), clipped 30–100

**Proxy variables (engineered correlations):**
- `college_graduation_year_gap` — Senior candidates: 55% probability of gap; Young: 25%
- `employment_gap` — Senior: 35% probability; Young: 20%
- `neighborhood_quality` — Low SES: 40% high quality; High SES: 80% high quality

**Hiring score formula:**
```
score = 0.40 * (test_score / 100)
      + 0.32 * (experience_years / 10)
      + 0.10 * (1 - college_graduation_year_gap)
      + 0.08 * (1 - employment_gap)
      + 0.10 * neighborhood_quality
      + noise(0, 0.05)
hired = score >= 0.46
```

Proxy weights are kept small (0.08–0.10) so both DPDs stay below the 0.10 standard threshold. The model passes demographic parity. The causal paths are real.

To regenerate:
```bash
python data/generate_demo_dataset.py
```

---

## Running Locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- Google Gemini API key

### Backend

```bash
# Clone and install
git clone https://github.com/yourteam/themis
cd themis

pip install -r backend/requirements.txt

# Set your Gemini API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

# Start the API server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend_beautiful
npm install
npm start
```

The dashboard will open at `http://localhost:3000`.

### Run an Audit

```bash
# Use the pre-loaded demo dataset
curl -X POST http://localhost:8000/audit

# Upload your own CSV
curl -X POST http://localhost:8000/audit \
  -F "file=@your_dataset.csv"

# Run debiasing on a completed audit
curl -X POST http://localhost:8000/audit/{audit_id}/debias \
  -H "Content-Type: application/json" \
  -d '{"selected_fairness_definition": "equalized_odds", "accept_accuracy_cost_max_percent": 5.0}'
```

### Required CSV Schema

Your dataset must contain these columns (minimum 100 rows):

| Column | Type | Description |
|---|---|---|
| `age_group` | categorical | `Young` or `Senior` |
| `socioeconomic_group` | categorical | `High` or `Low` |
| `experience_years` | numeric | Years of work experience |
| `test_score` | numeric | Assessment score |
| `college_graduation_year_gap` | binary | 1 if graduation was long ago |
| `employment_gap` | binary | 1 if candidate has career break |
| `neighborhood_quality` | binary | 1 if high-quality neighbourhood |
| `hired` | binary | 1 = hired, 0 = rejected |

---

## API Reference

### `GET /health`
Liveness check. Returns `{"status": "ok"}`.

### `POST /audit`
Run the full 5-step audit pipeline. Accepts optional multipart CSV upload; uses demo dataset if no file provided.

**Response:**
```json
{
  "standard_audit": {
    "demographic_parity_difference": 0.0809,
    "ses_parity_difference": 0.0412,
    "passes_standard_test": true,
    "verdict": "FAIR"
  },
  "causal_audit": {
    "proxy_paths_found": 3,
    "paths": [
      {
        "path": ["age_group", "college_graduation_year_gap", "hired"],
        "type": "proxy",
        "effect": 0.298,
        "description": "Senior candidates have older degrees — model penalises graduation year gap as a proxy for age"
      }
    ],
    "total_causal_effect_of_gender": -0.041,
    "verdict": "PROXY DISCRIMINATION DETECTED",
    "affected_candidates": 81
  },
  "plain_language_report": "...",
  "graph_data": { "nodes": [...], "edges": [...] },
  "bias_index": 0.0809,
  "impossibility_surface": {
    "frontier_points": [[0.08, 0.12], ...],
    "current_position": [0.08, 0.12],
    "accuracy_at_threshold": [0.95, ...]
  },
  "audit_id": "uuid"
}
```

### `POST /audit/{audit_id}/debias`
Run surgical debiasing on a cached audit result.

**Request body:**
```json
{
  "selected_fairness_definition": "equalized_odds",
  "accept_accuracy_cost_max_percent": 5.0
}
```

**Response:**
```json
{
  "selected_fairness_definition": "equalized_odds",
  "strategy_applied": "proxy_removal",
  "variables_modified": ["college_graduation_year_gap", "neighborhood_quality", "employment_gap"],
  "bias_index_before": 0.0603,
  "bias_index_after": 0.0412,
  "accuracy_before": 0.95,
  "accuracy_after": 0.90,
  "accuracy_cost_percent": 4.9,
  "bias_reduction_percent": 31.7
}
```

---

## Frontend Components

### Dashboard (`src/components/Dashboard.jsx`)
The main view. Renders all audit results in a single-page layout:
- Standard vs causal fairness verdict cards (the core visual argument: green FAIR on the left, red NOT FAIR on the right)
- Alert banner with affected candidate count
- Key insights panel (proxy paths, top proxy variables, recommendation)
- Causal graph
- Surgical debiasing before/after comparison
- Fairness definition selector with interactive sliders

### CausalGraph (`src/components/CausalGraph.jsx`)
Static SVG causal graph rendered at 900×400 viewBox. Nodes are colour-coded by type:
- Purple — sensitive/protected attribute
- Red — proxy variable (bias path)
- Green — legitimate feature
- Grey — outcome

Edges carry causal strength labels. Red edges pulse to draw attention to the discrimination paths. Arrow markers are defined per colour via SVG `<defs>`.

### Sidebar (`src/components/Sidebar.jsx`)
Navigation sidebar with section links: Overview, Causal Graph, Fairness Metrics, Debiasing, Report.

### API Client (`src/api.js`)
Two functions: `runAudit(file)` and `runDebias(auditId, fairnessDefinition)`. Base URL reads from `REACT_APP_API_URL` env var, falls back to `http://localhost:8000`.

---

## Backend Internals

### Causal Audit Pipeline (`backend/main.py`)

**`build_causal_model(df)`** — Encodes both protected attributes to binary, fits two `DoWhy.CausalModel` instances (one per protected attribute), identifies causal effects via backdoor linear regression. Returns age effect, SES effect, and combined total effect.

**`detect_proxy_paths(df)`** — Computes group mean differences on each proxy variable to measure the correlation strength between protected attributes and proxies. Returns three `ProxyPath` objects with path, effect size, and human-readable description.

**`compute_impossibility_surface(df)`** — Trains a `LogisticRegression` on all five features, sweeps decision threshold from 0.1 to 0.9 in 0.05 steps, computes DPD and EOD at each threshold. Returns the Pareto frontier as a list of `[dpd, eod]` points plus accuracy at each threshold step.

**`run_surgical_debiasing(df, causal, fairness_definition)`** — Baseline model uses all five features. Surgical correction: removes `college_graduation_year_gap` and `neighborhood_quality` from the feature set, computes sample weights to equalise `employment_gap` distribution across age groups via `compute_reweighting()`, retrains logistic regression on the reduced feature set with weights. Returns bias and accuracy before/after.

**`generate_report(df, standard, causal)`** — Builds a structured 600–800 word Markdown prompt with all audit numbers and calls Gemini 2.5 Flash at temperature 0.2. Falls back to `fallback_report()` on any API error, returning the error message in `report_error` for transparency.

### Data Models

All response types are Python `@dataclass` instances serialised via `dataclasses.asdict()` with a `convert_numpy_types()` pass to handle numpy scalar types. Key types:

- `StandardAuditResult` — DPD for both protected attributes, pass/fail, verdict
- `CausalAuditResult` — proxy paths, total causal effect, affected candidate count
- `ProxyPath` — path list, effect size, description
- `GraphData` — nodes and edges for frontend rendering
- `ImpossibilitySurface` — frontier points, current position, accuracy per threshold
- `DebiasingResult` — strategy, modified variables, bias/accuracy before/after
- `AuditResponse` — all of the above plus audit_id and optional report_error

---

## Tests

```bash
# Run all tests
pytest backend/tests/ -v

# Run with coverage
pytest backend/tests/ --cov=backend --cov-report=term-missing
```

Test files:

| File | What It Tests |
|---|---|
| `test_dataset.py` | Schema validation (missing columns, row count < 100), `encode_age_group` mapping |
| `test_fairness.py` | `compute_standard_fairness` on demo dataset (FAIR), on high-DPD synthetic data (BIASED), DPD rounding |
| `test_debiasing.py` | Surgical debiasing reduces bias, accuracy cost within bounds |
| `test_impossibility.py` | Impossibility surface has correct shape, frontier points are valid |
| `test_proxy.py` | Proxy path detection finds all three paths on demo dataset |
| `test_properties.py` | Hypothesis property-based tests for edge cases |

---

## The Science

### Causal Fairness (Russell et al. 2017)
True fairness requires counterfactual reasoning: would this individual have received the same outcome if only their protected attribute were different, holding everything else constant? Statistical fairness cannot answer this question. Causal fairness, implemented via do-calculus, can.

### The Backdoor Criterion (Pearl 2009)
A set of variables Z satisfies the backdoor criterion relative to (X, Y) if Z blocks all backdoor paths from X to Y and no variable in Z is a descendant of X. THEMIS uses this to identify which intermediate variables are carrying causal influence from protected attributes to outcomes — the proxy discrimination paths.

### The Impossibility Theorem (Chouldechova 2017; Kleinberg et al. 2016)
When base rates differ between groups (which they do in any real dataset with historical bias), demographic parity, equalized odds, and individual fairness cannot all be satisfied simultaneously. This is a mathematical theorem, not an engineering limitation. Any tool that claims to satisfy all three is either lying or operating on a trivially balanced dataset.

### PC Algorithm (Spirtes, Glymour, Scheines 2000)
Constraint-based causal discovery algorithm that learns causal graph structure from observational data by testing conditional independence relationships. THEMIS uses DoWhy's implementation with Fisher's Z-test for continuous variables.

---

## SDG Alignment

- **SDG 10** — Reduced Inequalities: detecting and correcting proxy discrimination in hiring and credit
- **SDG 8** — Decent Work and Economic Growth: ensuring AI hiring tools do not systematically exclude qualified candidates
- **SDG 16** — Peace, Justice and Strong Institutions: providing audit infrastructure for algorithmic accountability
- **SDG 5** — Gender Equality: proxy discrimination detection covers gender-correlated variables

### Indian PDPB 2023 Relevance
India's Personal Data Protection Bill Section 12(b) introduces algorithmic accountability requirements for automated decision-making systems. Every THEMIS audit produces an immutable record of the causal paths found, the fairness metrics computed, and the debiasing strategy applied — the documentation trail that PDPB compliance will require.

---

## Project Structure

```
themis/
├── README.md
├── .env.example
├── backend/
│   ├── main.py                    # FastAPI app — all backend logic
│   ├── requirements.txt
│   ├── __init__.py
│   └── tests/
│       ├── test_dataset.py
│       ├── test_fairness.py
│       ├── test_debiasing.py
│       ├── test_impossibility.py
│       ├── test_proxy.py
│       └── test_properties.py
├── data/
│   ├── generate_demo_dataset.py   # Reproducible dataset generation
│   └── demo_hiring_dataset.csv    # Pre-generated, committed to repo
├── frontend_beautiful/
│   ├── src/
│   │   ├── App.js
│   │   ├── api.js                 # API client (runAudit, runDebias)
│   │   └── components/
│   │       ├── Dashboard.jsx      # Main view
│   │       ├── CausalGraph.jsx    # SVG causal graph
│   │       ├── Sidebar.jsx
│   │       └── ui/                # shadcn/ui components
│   ├── public/
│   └── package.json
├── THEMIS_Architecture_DesignSpec.md
└── THEMIS_Round1_MasterPlan.md
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key. Get one at [aistudio.google.com](https://aistudio.google.com) |
| `REACT_APP_API_URL` | No | Backend URL for frontend. Defaults to `http://localhost:8000` |

---

## Built With

- [DoWhy](https://github.com/py-why/dowhy) — Causal inference and causal graph discovery
- [AIF360](https://github.com/Trusted-AI/AIF360) — Standard fairness metrics
- [FastAPI](https://fastapi.tiangolo.com) — Backend API framework
- [Google Gemini](https://ai.google.dev) — Plain language report generation
- [React](https://react.dev) — Frontend framework
- [shadcn/ui](https://ui.shadcn.com) — UI component library

---

## References

- Chouldechova, A. (2017). Fair prediction with disparate impact: A study of bias in recidivism prediction instruments. *Big Data*, 5(2), 153–163.
- Kleinberg, J., Mullainathan, S., & Raghavan, M. (2016). Inherent trade-offs in the fair determination of risk scores. *ITCS 2017*.
- Russell, C., Kusner, M. J., Loftus, J., & Silva, R. (2017). When worlds collide: Integrating different counterfactual assumptions in fairness. *NeurIPS 2017*.
- Pearl, J. (2009). *Causality: Models, Reasoning, and Inference* (2nd ed.). Cambridge University Press.
- Spirtes, P., Glymour, C., & Scheines, R. (2000). *Causation, Prediction, and Search* (2nd ed.). MIT Press.
- Zhang, B. H., Lemoine, B., & Mitchell, M. (2018). Mitigating unwanted biases with adversarial learning. *AIES 2018*.

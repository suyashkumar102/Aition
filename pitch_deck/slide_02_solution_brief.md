# Slide 2 — Brief About the Solution

**αἴτιον** (aítion) — Ancient Greek for *cause, the answer to "Why?"*
Aristotle's term for the underlying reason behind any event. Root of *etiology*.
We don't ask *what happened* — we ask *why*.

---

**What is Aition?**
A Causal AI Fairness Engine that finds discrimination standard tools miss — because it thinks causally, not statistically.

**The problem in one line:**
A model can pass every standard fairness test and still discriminate through hidden proxy variables.

**What Aition does:**
- Builds a causal graph of how the model actually decides
- Traces proxy paths: Age → Graduation Gap → Hired
- Generates a plain-language report for non-technical stakeholders

**Demo result:** Standard tools found 0 proxy paths. Aition found 3. 81 candidates affected.

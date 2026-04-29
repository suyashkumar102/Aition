# Aition — 3 Minute Demo Script

---

## [0:00 – 0:20] THE HOOK

**Screen:** Blank dashboard. No data loaded.

> "Imagine you're an HR director. Your hiring AI passed every fairness test.
> You're legally compliant. Confident.
> And you have no idea it's been rejecting qualified candidates
> based on age and background — because the tool you used to check
> was blind to what your AI was actually doing."

---

## [0:20 – 0:45] THE STANDARD AUDIT FAILS

**Screen:** Click "Use Demo Dataset". Results load. Zoom into green FAIR card.

> "2,000 hiring decisions. Standard fairness audit says FAIR. DPD: 0.08.
> Most organisations stop here."

**Screen:** Hold on green FAIR badge for 2 seconds.

> "Aition doesn't stop here."

---

## [0:45 – 1:30] THE CAUSAL AUDIT

**Screen:** Pan to red "PROXY DISCRIMINATION DETECTED" card. Proxy Paths: 3.

> "Aition builds a causal graph of how this model actually makes decisions —
> not output rates. The mechanism."

**Screen:** Causal graph. Zoom slowly onto red proxy edges. Hold 4 seconds — no voiceover.

> "Age and socioeconomic background never appear directly.
> Graduation year gap, employment gaps, neighbourhood quality do the work —
> correlated with protected attributes in historical data.
> The model learned this. Invisibly."

---

## [1:30 – 2:00] THE REPORT

**Screen:** Scroll to Plain Language Report. Zoom into "Who Was Affected" section.

> "A report for the person who is actually accountable — not the ML engineer.
> A number of people. Not a metric."

---

## [2:00 – 2:30] THE DEBIASING

**Screen:** Click "Run Surgical Debiasing". Results appear.

> "Bias drops 65%. Accuracy cost: 5.5%.
> Only the discriminatory components removed. No full retraining."

---

## [2:30 – 3:00] THE CLOSE

**Screen:** Full dashboard visible — both verdict cards, causal graph, debiasing panel.

> "Standard tools found zero proxy paths. Aition found three.
> The model passed every test. It was discriminating anyway.
> That's the gap Aition closes."

**Screen:** Fade to Aition logo.

> "Because passing the test and being fair are not the same thing."

---

## Checklist
- [ ] Backend running at `localhost:8000`
- [ ] Frontend at `localhost:3000`, browser zoom 110%
- [ ] Record 1920×1080, notifications off
- [ ] Add subtitles before uploading

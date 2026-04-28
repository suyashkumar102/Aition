"""
Aition Round 1 MVP — Demo Dataset Generator
Generates a synthetic hiring dataset engineered to demonstrate proxy discrimination.

Protected attributes:
  - age_group (Young / Senior)
  - socioeconomic_group (High / Low)

Proxy paths:
  age_group → college_graduation_year_gap → hired
  age_group → employment_gap → hired
  socioeconomic_group → neighborhood_quality → hired

Usage:
    python data/generate_demo_dataset.py
"""

import numpy as np
import pandas as pd
import os


def generate_dataset(seed: int = 42, n: int = 2000) -> pd.DataFrame:
    """
    Generate synthetic hiring dataset with engineered proxy bias across two
    protected attributes.

    Designed so that:
    - DPD for age_group < 0.10 (passes standard threshold)
    - DPD for socioeconomic_group < 0.10 (passes standard threshold)
    - Three proxy discrimination paths exist:
        age_group → college_graduation_year_gap → hired
        age_group → employment_gap → hired
        socioeconomic_group → neighborhood_quality → hired

    Returns:
        DataFrame with columns: age_group, socioeconomic_group,
        experience_years, test_score, college_graduation_year_gap,
        employment_gap, neighborhood_quality, hired.
    """
    np.random.seed(seed)

    # ── Protected attribute 1: Age group ─────────────────────────────────────
    age_group = np.random.choice(['Young', 'Senior'], size=n, p=[0.5, 0.5])
    is_senior = age_group == 'Senior'
    is_young  = age_group == 'Young'

    # ── Protected attribute 2: Socioeconomic group ───────────────────────────
    socioeconomic_group = np.random.choice(['High', 'Low'], size=n, p=[0.5, 0.5])
    is_low  = socioeconomic_group == 'Low'
    is_high = socioeconomic_group == 'High'

    # ── Legitimate features ───────────────────────────────────────────────────
    experience_years = np.random.randint(1, 11, size=n)
    test_score = np.clip(np.random.normal(65.0, 15.0, size=n), 30.0, 100.0)

    # ── Proxy 1: college_graduation_year_gap (age proxy) ─────────────────────
    # Senior candidates graduated longer ago → higher gap
    # Senior: 55% | Young: 25%
    n_senior = is_senior.sum()
    n_young  = is_young.sum()
    college_graduation_year_gap = np.empty(n, dtype=int)
    college_graduation_year_gap[is_senior] = np.random.binomial(1, 0.55, size=n_senior)
    college_graduation_year_gap[is_young]  = np.random.binomial(1, 0.25, size=n_young)

    # ── Proxy 2: employment_gap (age proxy) ───────────────────────────────────
    # Senior candidates more likely to have career breaks
    # Senior: 35% | Young: 20%
    employment_gap = np.empty(n, dtype=int)
    employment_gap[is_senior] = np.random.binomial(1, 0.35, size=n_senior)
    employment_gap[is_young]  = np.random.binomial(1, 0.20, size=n_young)

    # ── Proxy 3: neighborhood_quality (socioeconomic proxy) ──────────────────
    # Low-SES candidates more likely to come from lower-quality neighborhoods
    # (zip-code style proxy — correlated with SES in historical data)
    # Low SES: 60% chance of low neighborhood quality (0=low, 1=high)
    # High SES: 20% chance of low neighborhood quality
    n_low  = is_low.sum()
    n_high = is_high.sum()
    neighborhood_quality = np.empty(n, dtype=int)
    neighborhood_quality[is_low]  = np.random.binomial(1, 0.40, size=n_low)   # 40% high quality
    neighborhood_quality[is_high] = np.random.binomial(1, 0.80, size=n_high)  # 80% high quality

    # ── Hired label ───────────────────────────────────────────────────────────
    # Legitimate: test_score (0.40), experience_years (0.32)
    # Age proxies: college_graduation_year_gap (0.10), employment_gap (0.08)
    # SES proxy:   neighborhood_quality (0.10)
    # Weights sum to 1.0; proxy weights kept small so DPD stays under 0.10
    score = (
        0.40 * (test_score / 100.0)
        + 0.32 * (experience_years / 10.0)
        + 0.10 * (1.0 - college_graduation_year_gap)   # penalises older degree
        + 0.08 * (1.0 - employment_gap)                # penalises career breaks
        + 0.10 * neighborhood_quality                  # penalises low-quality neighbourhood
    )
    noise = np.random.normal(0.0, 0.05, size=n)
    hired = (score + noise >= 0.46).astype(int)

    df = pd.DataFrame({
        'age_group':                   age_group,
        'socioeconomic_group':         socioeconomic_group,
        'experience_years':            experience_years,
        'test_score':                  test_score.round(4),
        'college_graduation_year_gap': college_graduation_year_gap,
        'employment_gap':              employment_gap,
        'neighborhood_quality':        neighborhood_quality,
        'hired':                       hired,
    })

    # ── Statistics ────────────────────────────────────────────────────────────
    young_rate  = df[df['age_group'] == 'Young']['hired'].mean()
    senior_rate = df[df['age_group'] == 'Senior']['hired'].mean()
    high_rate   = df[df['socioeconomic_group'] == 'High']['hired'].mean()
    low_rate    = df[df['socioeconomic_group'] == 'Low']['hired'].mean()
    dpd_age = abs(young_rate - senior_rate)
    dpd_ses = abs(high_rate - low_rate)

    print(f"Young hire rate:   {young_rate:.4f}  |  Senior hire rate: {senior_rate:.4f}  |  DPD(age): {dpd_age:.4f}  {'FAIR' if dpd_age < 0.10 else 'BIASED'}")
    print(f"High SES rate:     {high_rate:.4f}  |  Low SES rate:     {low_rate:.4f}  |  DPD(ses): {dpd_ses:.4f}  {'FAIR' if dpd_ses < 0.10 else 'BIASED'}")
    print(f"Total rows: {len(df)}")

    output_path = os.path.join(os.path.dirname(__file__), 'demo_hiring_dataset.csv')
    df.to_csv(output_path, index=False)
    print(f"Dataset saved to: {output_path}")
    return df


if __name__ == '__main__':
    generate_dataset(seed=42, n=2000)

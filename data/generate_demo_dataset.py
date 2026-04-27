"""
Aition Round 1 MVP — Demo Dataset Generator
Generates a synthetic hiring dataset engineered to demonstrate proxy discrimination.

Usage:
    python data/generate_demo_dataset.py
"""

import numpy as np
import pandas as pd
import os


def generate_dataset(seed: int = 42, n: int = 2000) -> pd.DataFrame:
    """
    Generate synthetic hiring dataset with engineered proxy bias.

    The dataset is designed so that:
    - Demographic parity difference is ~0.08 (passes the 0.10 threshold)
    - Two proxy discrimination paths exist:
        gender → college_tier → hired
        gender → employment_gap → hired

    Args:
        seed: Random seed for reproducibility.
        n: Number of rows to generate.

    Returns:
        DataFrame with columns: gender, experience_years, test_score,
        college_tier, employment_gap, hired.
    """
    np.random.seed(seed)

    # ── Gender: 50/50 M/F split ───────────────────────────────────────────────
    gender = np.random.choice(['M', 'F'], size=n, p=[0.5, 0.5])
    is_female = gender == 'F'
    is_male = gender == 'M'

    # ── experience_years: uniform int 1–10 ───────────────────────────────────
    experience_years = np.random.randint(1, 11, size=n)

    # ── test_score: normal float clipped to [30, 100] ────────────────────────
    test_score = np.random.normal(loc=65.0, scale=15.0, size=n)
    test_score = np.clip(test_score, 30.0, 100.0)

    # ── college_tier: gender-stratified probabilities ────────────────────────
    # F: [0.30, 0.45, 0.25] for tiers [1, 2, 3]
    # M: [0.45, 0.40, 0.15] for tiers [1, 2, 3]
    college_tier = np.empty(n, dtype=int)
    n_female = is_female.sum()
    n_male = is_male.sum()

    college_tier[is_female] = np.random.choice(
        [1, 2, 3], size=n_female, p=[0.30, 0.45, 0.25]
    )
    college_tier[is_male] = np.random.choice(
        [1, 2, 3], size=n_male, p=[0.45, 0.40, 0.15]
    )

    # ── employment_gap: gender-stratified probabilities ───────────────────────
    # F: 45% probability of gap=1
    # M: 20% probability of gap=1
    employment_gap = np.empty(n, dtype=int)
    employment_gap[is_female] = np.random.binomial(1, 0.45, size=n_female)
    employment_gap[is_male] = np.random.binomial(1, 0.20, size=n_male)

    # ── hired label: weighted formula + Gaussian noise, threshold 0.55 ───────
    # score = 0.4*(test_score/100) + 0.3*(experience/10)
    #       + 0.2*(1-(college_tier-1)/2) + 0.1*(1-employment_gap)
    score = (
        0.4 * (test_score / 100.0)
        + 0.3 * (experience_years / 10.0)
        + 0.2 * (1.0 - (college_tier - 1) / 2.0)
        + 0.1 * (1.0 - employment_gap)
    )
    noise = np.random.normal(loc=0.0, scale=0.05, size=n)
    score_noisy = score + noise
    hired = (score_noisy >= 0.55).astype(int)

    # ── Assemble DataFrame ────────────────────────────────────────────────────
    df = pd.DataFrame({
        'gender': gender,
        'experience_years': experience_years,
        'test_score': test_score.round(4),
        'college_tier': college_tier,
        'employment_gap': employment_gap,
        'hired': hired,
    })

    # ── Compute and print statistics ──────────────────────────────────────────
    male_hire_rate = df[df['gender'] == 'M']['hired'].mean()
    female_hire_rate = df[df['gender'] == 'F']['hired'].mean()
    dpd = abs(male_hire_rate - female_hire_rate)

    print(f"Male hire rate:   {male_hire_rate:.4f} ({male_hire_rate*100:.1f}%)")
    print(f"Female hire rate: {female_hire_rate:.4f} ({female_hire_rate*100:.1f}%)")
    print(f"Demographic Parity Difference (DPD): {dpd:.4f}")
    print(f"Standard fairness verdict: {'FAIR (passes 0.10 threshold)' if dpd < 0.10 else 'BIASED (fails 0.10 threshold)'}")
    print(f"Total rows: {len(df)}")

    # ── Save to CSV ───────────────────────────────────────────────────────────
    output_path = os.path.join(os.path.dirname(__file__), 'demo_hiring_dataset.csv')
    df.to_csv(output_path, index=False)
    print(f"Dataset saved to: {output_path}")

    return df


if __name__ == '__main__':
    generate_dataset(seed=42, n=2000)

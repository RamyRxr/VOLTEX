"""
Extract the fields we need from a CDC natality public-use file (fixed width),
straight from the zip, into a compact Parquet file.

Usage: python scripts/extract.py data/Nat2023us.zip data/births_2023.parquet

Positions are 1-based, from the CDC User Guide (2023 edition).
Only fields that SafeMaman's patient profile also collects are kept,
so the model can run on every patient.
"""

import sys
import zipfile
from collections.abc import Iterator
from contextlib import contextmanager
from typing import BinaryIO

import numpy as np
import pandas as pd

# name -> (start, end), 1-based inclusive, as in the User Guide
FIELDS = {
    "year": (9, 12),          # DOB_YY
    "age": (75, 76),          # MAGER: mother's single years of age
    "birth_order": (182, 182),  # TBO_REC: total birth order, 9 = unknown
    "bmi": (283, 286),        # BMI: pre-pregnancy, 99.9 = unknown
    "rf_pdiab": (313, 313),   # pre-pregnancy diabetes Y/N/U
    "rf_gdiab": (314, 314),   # gestational diabetes Y/N/U
    "rf_phype": (315, 315),   # pre-pregnancy (chronic) hypertension Y/N/U
    "rf_ghype": (316, 316),   # gestational hypertension Y/N/U (outcome)
    "rf_ehype": (317, 317),   # hypertension eclampsia Y/N/U (outcome)
    "rf_inftr": (325, 325),   # infertility treatment used Y/N/U
    "plurality": (454, 454),  # DPLURAL: 1 single, 2 twin, 3+ ...
}

YN = {"Y": 1.0, "N": 0.0}


def flag(values: pd.Series) -> pd.Series:
    """Y -> 1, N -> 0, anything else (U, blank) -> NaN."""
    return values.map(YN).astype("float32")


CHUNK_ROWS = 500_000


@contextmanager
def open_source(path: str) -> Iterator[BinaryIO]:
    """The fixed-width file, from a .zip or already unpacked (the 2023 zip uses
    Deflate64, which Python's zipfile cannot read: unpack it with Windows first)."""
    if path.lower().endswith(".zip"):
        with zipfile.ZipFile(path) as zf:
            name = max(zf.infolist(), key=lambda i: i.file_size).filename
            with zf.open(name) as fh:
                yield fh
    else:
        with open(path, "rb") as fh:
            yield fh


def read_chunks(path: str) -> Iterator[pd.DataFrame]:
    """Raw text fields, CHUNK_ROWS lines at a time (keeps memory low)."""
    with open_source(path) as fh:
        rows: list[tuple[str, ...]] = []
        for raw in fh:
            line = raw.decode("latin-1")
            rows.append(tuple(line[s - 1 : e] for s, e in FIELDS.values()))
            if len(rows) == CHUNK_ROWS:
                yield pd.DataFrame(rows, columns=list(FIELDS))
                rows = []
        if rows:
            yield pd.DataFrame(rows, columns=list(FIELDS))


def decode(raw: pd.DataFrame) -> pd.DataFrame:
    """Raw CDC codes -> model columns (floats, NaN when unknown)."""
    bmi = pd.to_numeric(raw["bmi"], errors="coerce").astype("float32")
    order = pd.to_numeric(raw["birth_order"], errors="coerce")
    plurality = pd.to_numeric(raw["plurality"], errors="coerce")

    return pd.DataFrame(
        {
            "year": pd.to_numeric(raw["year"], errors="coerce").astype("int16"),
            "age": pd.to_numeric(raw["age"], errors="coerce").astype("float32"),
            "bmi": bmi.where(bmi < 99.0),
            "first_pregnancy": np.where(order.isin([9]) | order.isna(), np.nan, (order == 1).astype("float32")).astype("float32"),
            "multiple_pregnancy": np.where(plurality.isna(), np.nan, (plurality > 1).astype("float32")).astype("float32"),
            "infertility_treatment": flag(raw["rf_inftr"]),
            "preexisting_diabetes": flag(raw["rf_pdiab"]),
            "gestational_diabetes": flag(raw["rf_gdiab"]),
            "chronic_hypertension": flag(raw["rf_phype"]),
            "gestational_hypertension": flag(raw["rf_ghype"]),
            "eclampsia": flag(raw["rf_ehype"]),
        }
    )


def extract(zip_path: str, out_path: str) -> None:
    df = pd.concat((decode(chunk) for chunk in read_chunks(zip_path)), ignore_index=True)
    df.to_parquet(out_path, index=False)
    print(f"{out_path}: {len(df):,} births")


if __name__ == "__main__":
    extract(sys.argv[1], sys.argv[2])

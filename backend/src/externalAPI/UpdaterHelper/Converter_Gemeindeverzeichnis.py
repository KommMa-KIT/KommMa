"""
Converter_Gemeindeverzeichnis.py

This file converts downloaded Destatis "Gemeindeverzeichnis" Excel files into slim CSV files
optimized for fast searching.

Features:
- Automatically selects the correct sheet (must contain a column matching "Satzart")
- Filters to Satzart == 60 (municipalities)
- Builds AGS (8 digits)
- Exports: AGS, PLZ, NAME, LANDKREIS, LAENGENGRAD, BREITENGRAD, FLAECHE_KM2, EINWOHNER, BEVOELKERUNGSDICHTE
- Writes CSV atomically (tmp -> final)
- Copies Excel to a temp folder (avoids OneDrive/Excel locks), closes handles cleanly
- Folder conversion: all *.xlsx (excluding Excel lockfiles ~$.xlsx), optional output directory
- Optionally deletes the Excel after successful conversion (default: False)

Author: Jonas Dorner (@OilersLD)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import logging
import pandas as pd
import re
import shutil
import tempfile

from externalAPI.Constants import Constants as C


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ConvertResult:
    success: bool
    input_excel: Path | None = None
    output_csv: Path | None = None
    error: str | None = None
    used_sheet: str | None = None
    rows: int | None = None
    deleted_input: bool = False


class Converter_Gemeindeverzeichnis:
    # =========================
    # Helpers
    # =========================

    @staticmethod
    def _norm(s: object) -> str:
        return re.sub(C.CONVERTER_GEMEINDEVERZEICHNIS_WHITESPACE_REGEX, C.CONVERTER_GEMEINDEVERZEICHNIS_SPACE, str(s)).strip().casefold()

    @staticmethod
    def _safe_str(series: pd.Series) -> pd.Series:
        s = series.astype(str).str.strip()
        s = s.str.replace(C.CONVERTER_GEMEINDEVERZEICHNIS_TRAILING_DOT_ZERO_REGEX, C.CONVERTER_GEMEINDEVERZEICHNIS_EMPTY, regex=True)
        return s

    @staticmethod
    def _zfill(series: pd.Series, width: int) -> pd.Series:
        return Converter_Gemeindeverzeichnis._safe_str(series).str.replace(
            C.CONVERTER_GEMEINDEVERZEICHNIS_WHITESPACE_REGEX,
            C.CONVERTER_GEMEINDEVERZEICHNIS_EMPTY,
            regex=True
        ).str.zfill(width)

    @staticmethod
    def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
        if not isinstance(df.columns, pd.MultiIndex):
            df.columns = [
                re.sub(C.CONVERTER_GEMEINDEVERZEICHNIS_WHITESPACE_REGEX, C.CONVERTER_GEMEINDEVERZEICHNIS_SPACE, str(c)).strip()
                for c in df.columns
            ]
            return df

        flat: list[str] = []
        for col in df.columns:
            parts: list[str] = []
            for p in col:
                ps = str(p).strip()
                if (
                        not ps
                        or ps.lower() == C.CONVERTER_GEMEINDEVERZEICHNIS_NAN_STRING
                        or ps.startswith(C.CONVERTER_GEMEINDEVERZEICHNIS_EXCEL_UNNAMED_PREFIX)
                ):
                    continue
                parts.append(ps)

            # Remove direct duplicates
            out: list[str] = []
            for p in parts:
                if not out or out[-1] != p:
                    out.append(p)

            flat.append(C.CONVERTER_GEMEINDEVERZEICHNIS_MULTIINDEX_JOINER.join(out) if out else C.CONVERTER_GEMEINDEVERZEICHNIS_EMPTY)

        df.columns = flat
        return df

    @staticmethod
    def _find_col(df: pd.DataFrame, needles: list[str]) -> str:
        cols = list(df.columns)
        cols_norm = {c: Converter_Gemeindeverzeichnis._norm(c) for c in cols}

        for needle in needles:
            n = needle.casefold()
            for orig, cn in cols_norm.items():
                if n in cn:
                    return orig

        raise KeyError(
            C.CONVERTER_GEMEINDEVERZEICHNIS_ERR_COLUMN_NOT_FOUND_TEMPLATE.format(
                needles=needles,
                cols=cols,
            )
        )

    @staticmethod
    def _try_read_sheet(excel_path: Path, sheet_name: str) -> pd.DataFrame | None:
        for hdr in C.CONVERTER_GEMEINDEVERZEICHNIS_HEADER_CANDIDATES:
            try:
                df = pd.read_excel(excel_path, sheet_name=sheet_name, header=list(hdr))
                df = Converter_Gemeindeverzeichnis._flatten_columns(df)
                Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_SATZART))
                return df
            except Exception:
                return None


    @staticmethod
    def _select_correct_sheet(excel_path: Path) -> tuple[str, pd.DataFrame]:
        # Use ExcelFile as context manager to ensure clean handle closing
        with pd.ExcelFile(excel_path) as xls:
            for s in xls.sheet_names:
                print("S:", s)
                df = Converter_Gemeindeverzeichnis._try_read_sheet(excel_path, s)
                print("DF :", df)
                if df is not None:
                    return s, df
        raise RuntimeError(C.CONVERTER_GEMEINDEVERZEICHNIS_ERR_NO_SHEET_WITH_SATZART)

    @staticmethod
    def _atomic_write_csv(df: pd.DataFrame, out_path: Path, sep: str, encoding: str) -> None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = out_path.with_suffix(out_path.suffix + C.CONVERTER_GEMEINDEVERZEICHNIS_TMP_SUFFIX)
        df.to_csv(tmp_path, sep=sep, encoding=encoding, index=False)
        tmp_path.replace(out_path)

    # =========================
    # Public API
    # =========================

    @staticmethod
    def convert(
        input_excel: Path,
        output_csv: Path | None = None,
        *,
        sep: str = C.CSV_SEPARATOR_DEFAULT,
        encoding: str = C.CSV_ENCODING_DEFAULT,
        delete_input_on_success: bool = False,
    ) -> ConvertResult:
        """
        Converts one Destatis Excel file into a slim search CSV.

        Args:
            input_excel: Path to the Excel file (.xlsx).
            output_csv: Optional target CSV path. Default: next to Excel as '<stem>_suche.csv'.
            sep: CSV separator, default ';'
            encoding: CSV encoding, default 'utf-8-sig'
            delete_input_on_success: If True, deletes input_excel after a successful conversion.

        Returns:
            ConvertResult: success + metadata / error message.
        """
        input_excel = Path(input_excel)

        try:
            if not input_excel.exists():
                return ConvertResult(
                    False,
                    input_excel=input_excel,
                    error=f"{C.CONVERTER_GEMEINDEVERZEICHNIS_ERR_INPUT_NOT_FOUND_PREFIX}{input_excel}",
                )

            if output_csv is None:
                output_csv = input_excel.with_name(f"{input_excel.stem}{C.CONVERTER_GEMEINDEVERZEICHNIS_OUTPUT_SUFFIX}")
            else:
                output_csv = Path(output_csv)

            # Copy to temp to avoid OneDrive/Excel locks
            with tempfile.TemporaryDirectory() as td:
                td_path = Path(td)
                local_excel = td_path / input_excel.name
                shutil.copy2(input_excel, local_excel)

                # Select + read correct sheet
                sheet, df = Converter_Gemeindeverzeichnis._select_correct_sheet(local_excel)

                # Resolve columns (robust by "needle" tokens)
                col_satzart = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_SATZART))
                col_name = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_NAME))
                col_plz = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_PLZ))

                col_land = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_LAND))
                col_rb = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_RB))
                col_kreis = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_KREIS))
                col_gem = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_GEM))

                col_lon = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_LON))
                col_lat = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_LAT))
                col_flaeche = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_FLAECHE))
                col_einw = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_EINWOHNER))
                col_dichte = Converter_Gemeindeverzeichnis._find_col(df, list(C.CONVERTER_GEMEINDEVERZEICHNIS_NEEDLES_DICHTE))

                # Normalize Satzart as string (for filtering + lookups)
                df = df[df[col_satzart].notna()].copy()
                satzart_str = Converter_Gemeindeverzeichnis._safe_str(df[col_satzart])

                # ---------------------------------
                # Build district (Kreis) lookup (typically Satzart 40)
                # ---------------------------------
                kreis_df = df[satzart_str == C.CONVERTER_GEMEINDEVERZEICHNIS_SATZART_KREIS].copy()

                kreis_code_kreis = (
                    Converter_Gemeindeverzeichnis._zfill(kreis_df[col_land], 2)
                    + Converter_Gemeindeverzeichnis._zfill(kreis_df[col_rb], 1)
                    + Converter_Gemeindeverzeichnis._zfill(kreis_df[col_kreis], 2)
                )
                kreis_name_kreis = Converter_Gemeindeverzeichnis._safe_str(kreis_df[col_name])
                kreis_lookup = dict(zip(kreis_code_kreis, kreis_name_kreis))

                # ---------------------------------
                # Filter Satzart 60 (municipalities)
                # ---------------------------------
                df = df[satzart_str == C.SATZART].copy()

                land_code = Converter_Gemeindeverzeichnis._zfill(df[col_land], 2)

                # Keep only Baden-Württemberg
                df = df[land_code == C.LAENDERCODE_BW].copy()

                # AGS (8 digits)
                ags = (
                    Converter_Gemeindeverzeichnis._zfill(df[col_land], 2)
                    + Converter_Gemeindeverzeichnis._zfill(df[col_rb], 1)
                    + Converter_Gemeindeverzeichnis._zfill(df[col_kreis], 2)
                    + Converter_Gemeindeverzeichnis._zfill(df[col_gem], 3)
                )

                # PLZ (5 digits)
                plz = Converter_Gemeindeverzeichnis._zfill(df[col_plz], 5)

                # District code (5 digits) + district name
                kreis_code = (
                    Converter_Gemeindeverzeichnis._zfill(df[col_land], 2)
                    + Converter_Gemeindeverzeichnis._zfill(df[col_rb], 1)
                    + Converter_Gemeindeverzeichnis._zfill(df[col_kreis], 2)
                )
                landkreis = kreis_code.map(kreis_lookup).fillna(C.CONVERTER_GEMEINDEVERZEICHNIS_EMPTY)

                out = pd.DataFrame({
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_AGS: ags,
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_PLZ: plz,
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_NAME: Converter_Gemeindeverzeichnis._safe_str(df[col_name]),
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_LANDKREIS: landkreis,
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_LAENGENGRAD: df[col_lon],
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_BREITENGRAD: df[col_lat],
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_FLAECHE_KM2: df[col_flaeche],
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_EINWOHNER: df[col_einw],
                    C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_BEVOELKERUNGSDICHTE: df[col_dichte],
                }).sort_values([C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_NAME, C.CONVERTER_GEMEINDEVERZEICHNIS_OUT_COL_PLZ])

                Converter_Gemeindeverzeichnis._atomic_write_csv(out, output_csv, sep=sep, encoding=encoding)

            # Delete only after successful write
            deleted = False
            if delete_input_on_success:
                try:
                    input_excel.unlink()
                    deleted = True
                except Exception as del_err:
                    return ConvertResult(
                        True,
                        input_excel=input_excel,
                        output_csv=output_csv,
                        used_sheet=sheet,
                        rows=int(len(out)),
                        deleted_input=False,
                        error=C.CONVERTER_GEMEINDEVERZEICHNIS_ERR_CSV_OK_BUT_DELETE_FAILED_TEMPLATE.format(
                            err_type=type(del_err).__name__,
                            err=del_err,
                        ),
                    )

            return ConvertResult(
                True,
                input_excel=input_excel,
                output_csv=output_csv,
                used_sheet=sheet,
                rows=int(len(out)),
                deleted_input=deleted,
            )

        except Exception as e:
            return ConvertResult(
                False,
                input_excel=input_excel,
                output_csv=output_csv,
                error=C.CONVERTER_GEMEINDEVERZEICHNIS_ERR_EXCEPTION_TEMPLATE.format(
                    err_type=type(e).__name__,
                    err=e,
                ),
            )

    @staticmethod
    def convert_folder(
        folder: Path,
        *,
        pattern: str = C.CONVERTER_GEMEINDEVERZEICHNIS_DEFAULT_XLSX_PATTERN,
        out_dir: Path | None = None,
        sep: str = C.CSV_SEPARATOR_DEFAULT,
        encoding: str = C.CSV_ENCODING_DEFAULT,
        delete_input_on_success: bool = False,
    ) -> list[ConvertResult]:
        """
        Converts all XLSX files in a folder (excluding Excel lockfiles like ~$.xlsx).

        Args:
            folder: Folder containing XLSX files.
            pattern: Glob pattern, default '*.xlsx'.
            out_dir: Optional output folder. If None: next to each Excel file.
            sep/encoding: CSV settings.
            delete_input_on_success: Deletes XLSX after successful conversion (default False).

        Returns:
            One ConvertResult per file.
        """
        folder = Path(folder)
        if not folder.exists():
            return [ConvertResult(False, error=f"{C.CONVERTER_GEMEINDEVERZEICHNIS_ERR_FOLDER_NOT_FOUND_PREFIX}{folder}")]

        results: list[ConvertResult] = []
        for xlsx in sorted(folder.glob(pattern)):
            if not xlsx.is_file():
                continue
            if xlsx.name.startswith(C.CONVERTER_GEMEINDEVERZEICHNIS_EXCEL_LOCK_PREFIX):
                continue

            effective_out_dir = folder if out_dir is None else Path(out_dir)
            effective_out_dir.mkdir(parents=True, exist_ok=True)

            out_csv = effective_out_dir / f"{xlsx.stem}{C.CONVERTER_GEMEINDEVERZEICHNIS_OUTPUT_SUFFIX}"

            res = Converter_Gemeindeverzeichnis.convert(
                xlsx,
                output_csv=out_csv,
                sep=sep,
                encoding=encoding,
                delete_input_on_success=delete_input_on_success,
            )
            results.append(res)

        return results

"""
DataCityCategoriesExtractor
===========================
Scans Excel calculation workbooks to discover all **input-parameter categories**
("Datenkategorien") and exposes them grouped by theme area.

Business Purpose
----------------
The frontend form needs a structured catalogue of input fields (name, type,
unit, selectable options, sub-inputs) so each municipality can enter its data.
This extractor reads the data-sheet of every measure workbook, merges
duplicate categories across files, and writes a persistent
category-name -> camelCase-ID mapping to ``Input_fields_id.json``.

Architecture
------------
Implements ``InputParametersDataSource`` (``ApplicationLayer.DataApi.interfaces``),
so the application layer depends only on the protocol.

Thread Safety
-------------
The JSON mapping file is written behind a module-level ``threading.Lock``
to prevent corruption when multiple startup sequences run concurrently.
"""



import pandas as pd
import sys
import json
import logging

from typing import Dict, List, Any
from pathlib import Path
from threading import Lock

from ApplicationLayer.DataApi.interfaces import InputParametersDataSource


# Add src directory to Python path to enable imports (e.g. config)
src_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(src_dir))


PATH_FOR_JSON_INPUT_FIELDS = "/app/config/Input_fields_id.json"

logger = logging.getLogger(__name__)

# Global lock: protects parallel writes (multiple requests)
_JSON_WRITE_LOCK = Lock()


class DataCityCategoriesExtractor(InputParametersDataSource):
    def __init__(self, directory_path: str, sheet_index: int = 2):
        self.directory_path = Path(directory_path)
        self.sheet_index = sheet_index

        # Collects all category->ID mappings during a scan
        self._category_id_map: Dict[str, str] = {}

    def _clean_key(self, text: str) -> str:
        cleaned = str(text).strip()
        words = cleaned.replace('-', ' ').replace('_', ' ').split()

        if not words:
            return ""

        result = words[0].lower()
        for word in words[1:]:
            result += word.capitalize()

        return result

    def _parse_selectable(self, selectable_str: str) -> List[str]:
        if pd.isna(selectable_str) or str(selectable_str).strip() == "":
            return []
        options = [opt.strip() for opt in str(selectable_str).split(',')]
        return [opt for opt in options if opt]

    def _determine_input_type(self, input_type: str, selectable: str) -> str:
        if pd.isna(input_type):
            return "number"

        input_type_clean = str(input_type).lower().strip()

        if not pd.isna(selectable) and str(selectable).strip():
            return 'multiSelection' if 'multi' in input_type_clean else 'selection'

        return input_type_clean

    def _build_input_object(self, row: pd.Series, selectable_options: Dict[str, List[str]]) -> Dict[str, Any]:
        category = row.get('Datenkategorie', '')
        input_type = row.get('Input Type', 'number')
        unit = row.get('Einheit', '')
        description = row.get('Description', '')
        mandatory = row.get('Mandatory', False)

        input_id = self._clean_key(str(category))

        # Collect mappings in memory instead of writing per row
        if pd.notna(category) and str(category).strip():
            self._category_id_map[str(category).strip()] = input_id

        selectable_ref = row.get('Selectable', '')
        final_type = self._determine_input_type(input_type, selectable_ref)

        input_obj = {
            "id": input_id,
            "title": str(category).strip() if pd.notna(category) else "",
            "type": final_type
        }

        if final_type == 'number' and pd.notna(unit) and str(unit).strip():
            input_obj["unit"] = str(unit).strip()

        if final_type in ['selection', 'multiSelection']:
            if pd.notna(selectable_ref) and str(selectable_ref).strip():
                selectable_key = str(selectable_ref).strip()
                if selectable_key in selectable_options:
                    input_obj["selectable"] = selectable_options[selectable_key]
                else:
                    input_obj["selectable"] = self._parse_selectable(selectable_ref)
            else:
                input_obj["selectable"] = []

        input_obj["description"] = str(description).strip() if pd.notna(description) else ""
        input_obj["critical"] = bool(mandatory) if pd.notna(mandatory) else False
        input_obj["subinputs"] = []

        return input_obj

    def _extract_selectable_options(self, df: pd.DataFrame) -> Dict[str, List[str]]:
        selectable_options = {}
        for _, row in df.iterrows():
            if 'Selectable' in str(row.iloc[0]):
                key = str(row.iloc[0]).strip()
                value = str(row.iloc[1]).strip() if len(row) > 1 else ""
                if value:
                    selectable_options[key] = self._parse_selectable(value)
        return selectable_options

    def _extract_categories_from_file(self, file_path: Path) -> Dict[str, List[Dict[str, Any]]]:
        try:
            df_raw = pd.read_excel(file_path, sheet_name=self.sheet_index, header=None)

            header_row_idx = None
            for idx, row in df_raw.iterrows():
                if 'Themenbereich' in row.values:
                    header_row_idx = idx
                    break

            if header_row_idx is None:
                logger.warning("Workbook skipped: 'Themenbereich' header not found")
                return {}

            df = pd.read_excel(file_path, sheet_name=self.sheet_index, header=header_row_idx)
            selectable_options = self._extract_selectable_options(df_raw)

            required_cols = ['Themenbereich', 'Datenkategorie']
            if not all(col in df.columns for col in required_cols):
                logger.warning("Workbook skipped: required columns not found")
                return {}

            df_clean = df[df['Themenbereich'].notna() & df['Datenkategorie'].notna()].copy()

            categories_by_theme = {}
            inputs_by_id = {}

            for _, row in df_clean.iterrows():
                theme = row.get('Themenbereich')
                subinput_of = row.get('Subinput von', '')

                theme_clean = str(theme).strip()
                input_obj = self._build_input_object(row, selectable_options)

                inputs_by_id[input_obj['id']] = {
                    'object': input_obj,
                    'theme': theme_clean,
                    'subinput_of': str(subinput_of).strip() if pd.notna(subinput_of) else ''
                }

            for _, input_data in inputs_by_id.items():
                subinput_of = input_data['subinput_of']

                if subinput_of:
                    parent_id = self._clean_key(subinput_of)
                    if parent_id in inputs_by_id:
                        subinput_obj = input_data['object'].copy()
                        del subinput_obj['subinputs']
                        inputs_by_id[parent_id]['object']['subinputs'].append(subinput_obj)
                else:
                    theme = input_data['theme']
                    if theme not in categories_by_theme:
                        categories_by_theme[theme] = []
                    categories_by_theme[theme].append(input_data['object'])

            return categories_by_theme

        except IndexError:
            logger.info("Workbook skipped: configured sheet index not found")
            return {}
        except Exception as e:
            logger.exception("Error processing workbook for input categories")
            return {}

    def _merge_categories(self, all_categories: List[Dict[str, List[Dict[str, Any]]]]) -> Dict[str, List[Dict[str, Any]]]:
        merged = {}
        for file_categories in all_categories:
            for theme, categories in file_categories.items():
                if theme not in merged:
                    merged[theme] = []
                for category in categories:
                    exists = any(existing['id'] == category['id'] for existing in merged[theme])
                    if not exists:
                        merged[theme].append(category)

        for theme in merged:
            merged[theme] = sorted(merged[theme], key=lambda x: x['id'])

        return merged

    def _extract_categories_from_all_files(self) -> Dict[str, List[Dict[str, Any]]]:
        if not self.directory_path.exists():
            raise FileNotFoundError("Input directory not found")

        excel_files = list(self.directory_path.rglob("*.xlsx"))
        excel_files = [f for f in excel_files if not f.name.startswith("~$")]

        if not excel_files:
            raise ValueError(f"No Excel files found in {self.directory_path} (recursive search)")

        logger.info(f"Found {len(excel_files)} Excel file(s) to scan for data city categories")

        all_categories = []
        for excel_file in excel_files:
            logger.info("Scanning workbook for input categories")
            file_categories = self._extract_categories_from_file(excel_file)
            if file_categories:
                all_categories.append(file_categories)

        merged_categories = self._merge_categories(all_categories)

        # Write once at the end (thread-safe, robust against empty/corrupt JSON)
        self._flush_category_map(PATH_FOR_JSON_INPUT_FIELDS)

        total_categories = sum(len(categories) for categories in merged_categories.values())
        logger.info(
            "Found %d theme area(s) and %d total categories",
            len(merged_categories),
            total_categories,
        )

        return merged_categories

    def get_input_parameters(self) -> Dict[str, List[Dict[str, Any]]]:
        return self._extract_categories_from_all_files()

    def _flush_category_map(self, path: str) -> None:
        """Write self._category_id_map to JSON (merge with existing file)."""
        if not self._category_id_map:
            return

        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)

        with _JSON_WRITE_LOCK:
            existing: Dict[str, str] = {}

            if p.exists():
                raw = p.read_text(encoding="utf-8").strip()
                if raw:
                    try:
                        existing = json.loads(raw)
                        if not isinstance(existing, dict):
                            logger.warning("Input_fields_id.json is not a dict. Resetting it")
                            existing = {}
                    except json.JSONDecodeError:
                        logger.warning("Input_fields_id.json is invalid/partial. Resetting it")
                        existing = {}

            # Merge (new entries overwrite old ones)
            existing.update(self._category_id_map)

            p.write_text(
                json.dumps(existing, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

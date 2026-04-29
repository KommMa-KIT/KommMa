"""
MetaDataExtractor
=================
Scans a directory of Excel calculation workbooks and produces a structured
configuration mapping that describes **where** to inject municipal input
data and **where** to read back calculation results.

Business Purpose
----------------
Each climate-protection measure is modelled as a single ``.xlsx`` file with
a fixed sheet layout.  At application startup the ``MetaDataExtractor``
inspects every file once and builds a JSON-serialisable configuration dict
that the ``CalculationRepository`` consumes at request time -- decoupling
the formula engine from the physical Excel layout.

Scalability
-----------
Because the extraction result is a plain dictionary, it can be serialised
to JSON and loaded from a cache or database in the future, eliminating the
need to read Excel files on every startup.

Thread Safety
-------------
The extractor is stateless after ``generate_configuration()`` and safe to
share across threads for read-only operations.
"""

import sys
import pandas as pd
import logging

from pathlib import Path
from typing import Dict, Any

from DatabaseRepositoryLayer.baseExcelProcessor import BaseExcelProcessor


# Add src directory to Python path to enable imports
src_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(src_dir))


logger = logging.getLogger(__name__)


class MetaDataExtractor(BaseExcelProcessor):
    """
    Generates cell-level configuration mappings from Excel calculation files.

    For every ``.xlsx`` file the extractor discovers:
        - The measure ID and title (cells B2 / B3)
        - ``data_city_mapping``  -- which cells accept municipal input values
        - ``result_mapping``     -- which cells hold the computed results
          ("Werte" and "Kategorie" rows per result column)

    If the result sheet contains multiple reference-scenario blocks (several
    "Werte" rows), each scenario is emitted as a **separate** measure with
    a composite ID ``<measure_id>-<scenario_name>``.
    """
    
    def __init__(self, directory_path: str, data_sheet_index: int = 2, result_sheet_index: int = 6):
        """
        Configure the extractor for a specific directory and sheet layout.

        @param directory_path:     Path to the folder holding ``.xlsx`` files.
        @param data_sheet_index:   Zero-based index of the data-input sheet
                                   (default: ``2``).
        @param result_sheet_index: Zero-based index of the result sheet
                                   (default: ``6``).
        """
        super().__init__(data_sheet_index=data_sheet_index)
        
        self.directory_path = Path(directory_path)
        self.result_sheet_index = result_sheet_index
        
        # Result sheet configuration
        self.result_start_col = "F"  # Results start from column F (column E is "Bereich")
        self.result_end_col = "K"    # Results end at column K
        self.result_topic_row = 5     # Row 5 contains topic/header names
        self.result_value_row = 6     # Row 6 contains Werte (value) cells
        self.result_kategorie_row = 8 # Row 8 contains Kategorie (1-5) cells
    
    
    def _extract_data_mapping(self, df: pd.DataFrame) -> Dict[str, str]:
        """
        Build the ``data_city_mapping`` for one workbook.

        Reads data categories starting from column B, row 6 and maps each
        cleaned category name to the corresponding value cell in column F
        (e.g. ``{"fallhoehe": "F6", "einwohnerzahl": "F7"}``).  The
        ``CalculationRepository`` later uses these references to inject
        municipal input values before formula evaluation.

        @param df: DataFrame of the data sheet (loaded with ``header=None``).

        @return: ``{category_name: cell_reference, ...}``
        """
        data_mapping = {}
        
        # Use base class method to read data section
        data_section = self._read_data_section(df)
        
        # Map each category to its cell location in column F (Wert column)
        for category_clean, row_number in data_section.items():
            cell_ref = f"F{row_number}"
            data_mapping[category_clean] = cell_ref
        
        return data_mapping
    
    
    def _find_scenario_blocks(self, df: pd.DataFrame) -> list:
        """
        Locate all reference-scenario blocks in the result sheet.

        Some measures define multiple scenarios (e.g. different energy
        mixes).  Each scenario occupies three consecutive rows:

            - **Werte**      -- computed numeric values
            - **Umrechnung** -- conversion factors (Werte + 1)
            - **Kategorie**  -- categorical scale labels (Werte + 2)

        Scanning starts at ``result_value_row`` in column A and stops at
        the first empty cell.

        @param df: DataFrame of the result sheet (loaded with ``header=None``).

        @return: List of block dicts, each with ``werte_row``,
                 ``kategorie_row``, and ``scenario_name``.
        """
        blocks = []
        row_index = self.result_value_row          # first expected Werte row (Excel 1-indexed)
        
        while row_index <= len(df):
            cell_value = self._read_cell_value(df, f"A{row_index}")
            
            # Stop when we hit an empty cell
            if pd.isna(cell_value) or str(cell_value).strip() == "":
                break
            
            if str(cell_value).strip().lower() == "werte":
                kategorie_row = row_index + 2
                
                # Read scenario name from column E (Referenzszenario), one column before result_start_col
                scenario_value = self._read_cell_value(
                    df, f"E{row_index}"
                )
                scenario_name = ""
                if not pd.isna(scenario_value) and str(scenario_value).strip():
                    scenario_name = str(scenario_value).strip()
                
                blocks.append({
                    'werte_row': row_index,
                    'kategorie_row': kategorie_row,
                    'scenario_name': scenario_name
                })
            
            row_index += 1
        
        return blocks
    
    
    def _extract_result_mapping(
        self,
        df: pd.DataFrame,
        werte_row: int = None,
        kategorie_row: int = None
    ) -> Dict[str, Dict[str, str]]:
        """
        Build the ``result_mapping`` for one scenario block.

        Reads column headers from row 5 (columns F-K, skipping column E
        which is just a "Bereich" label) and pairs each header with the
        corresponding Werte and Kategorie cell references.

        @param df:            DataFrame of the result sheet.
        @param werte_row:     1-based Excel row for the Werte line
                              (defaults to ``self.result_value_row``).
        @param kategorie_row: 1-based Excel row for the Kategorie line
                              (defaults to ``self.result_kategorie_row``).

        @return: ``{field_name: {"werte": "F6", "kategorie": "F8"}, ...}``
        """
        result_mapping = {}
    
        # columns E to K
        start_col = ord(self.result_start_col) - ord('A')
        end_col = ord(self.result_end_col) - ord('A')
    
        # Use provided rows or fall back to defaults
        topic_row = self.result_topic_row
        w_row = werte_row if werte_row is not None else self.result_value_row
        k_row = kategorie_row if kategorie_row is not None else self.result_kategorie_row
    
        for col_idx in range(start_col, end_col + 1):
            col_letter = self._column_index_to_letter(col_idx)
        
            # Topic from header row
            topic = self._read_cell_value(df, f"{col_letter}{topic_row}")
        
            if pd.isna(topic) or str(topic).strip() == "":
                continue
        
            topic_clean = self._clean_key(str(topic))
        
            result_mapping[topic_clean] = {
                "werte": f"{col_letter}{w_row}",
                "kategorie": f"{col_letter}{k_row}"
            }
    
        return result_mapping
    
    
    def _process_excel_file(self, file_path: Path) -> Dict[str, Any]:
        """
        Extract the full configuration from a single Excel workbook.

        If the result sheet contains multiple reference-scenario blocks
        (several "Werte" rows) each scenario is emitted as a **separate**
        measure whose ID is ``<original_id>-<scenario_name>``.

        @param file_path: Absolute path to the ``.xlsx`` file.

        @return: ``{measure_id: config_dict, ...}`` for every scenario found,
                 or ``None`` if the file cannot be processed.
        """
        try:
            # Read the data sheet (for measure ID, name, and data mapping)
            df_data = pd.read_excel(file_path, sheet_name=self.data_sheet_index, header=None)
            
            # Read the result sheet (for result mapping)
            df_result = pd.read_excel(file_path, sheet_name=self.result_sheet_index, header=None)
            
            # Extract ID and name using base class method
            measure_id, measure_name = self._extract_id_and_name(df_data)
            
            if measure_id is None or measure_name is None:
                logger.warning("Could not find measure ID or name in workbook")
                return None
            
            # Clean the values
            measure_id_clean = measure_id.lower()
            measure_name_clean = self._clean_key(measure_name)
            
            # Extract data mapping from data sheet
            data_mapping = self._extract_data_mapping(df_data)
            
            # Get relative file path
            relative_path = file_path.relative_to(self.directory_path.parent)
            file_str = str(relative_path).replace("\\", "/")
            
            # ── Detect scenario blocks in the result sheet ──────────────
            scenario_blocks = self._find_scenario_blocks(df_result)
            
            # ── Single scenario (or none found): backward-compatible ────
            if len(scenario_blocks) <= 1:
                if scenario_blocks:
                    block = scenario_blocks[0]
                    result_mapping = self._extract_result_mapping(
                        df_result,
                        werte_row=block['werte_row'],
                        kategorie_row=block['kategorie_row']
                    )
                else:
                    result_mapping = self._extract_result_mapping(df_result)
                
                config = {
                    "measure_title": measure_name_clean,
                    "file": file_str,
                    "data_city_mapping": data_mapping,
                    "result_mapping": result_mapping
                }
                return {measure_id_clean: config}
            
            # ── Multiple scenarios: one entry per reference scenario ────
            configs = {}
            for block in scenario_blocks:
                scenario_name = block['scenario_name']
                scenario_name_clean = self._clean_key(scenario_name) if scenario_name else ""
                
                # Composite ID: measure_id-scenario_name
                if scenario_name_clean:
                    composite_id = f"{measure_id_clean}-{scenario_name_clean}"
                    composite_title = f"{measure_name_clean}_{scenario_name_clean}"
                else:
                    composite_id = measure_id_clean
                    composite_title = measure_name_clean
                
                result_mapping = self._extract_result_mapping(
                    df_result,
                    werte_row=block['werte_row'],
                    kategorie_row=block['kategorie_row']
                )
                
                config = {
                    "measure_title": composite_title,
                    "file": file_str,
                    "data_city_mapping": data_mapping,
                    "result_mapping": result_mapping
                }
                configs[composite_id] = config
            
            return configs
            
        except Exception as e:
            logger.error("Error processing workbook metadata")
            return None
    
    
    def generate_configuration(self) -> Dict[str, Any]:
        """
        Scan every ``.xlsx`` file and build the complete configuration mapping.

        This is the primary public entry point, called once at startup by
        ``CalculationRepository.__init__``.

        @return: ``{measure_id: {"measure_title": ..., "file": ...,
                 "data_city_mapping": {...}, "result_mapping": {...}}, ...}``

        @throws FileNotFoundError: If ``directory_path`` does not exist.
        @throws ValueError:        If no valid ``.xlsx`` files are found.

        Format::

            {
                "measure_id_1": {
                    "measure_title": "...",
                    "file": "...",
                    "data_city_mapping": {...},
                    "result_mapping": {...}
                },
                "measure_id_2": {...}
            }

        Raises:
            FileNotFoundError: If the directory doesn't exist.
            ValueError: If no valid Excel files are found.
        """
        if not self.directory_path.exists():
            raise FileNotFoundError("Metadata directory not found")
        
        # Find all Excel files using base class method
        excel_files = self._find_excel_files(self.directory_path)
        
        if not excel_files:
            raise ValueError(f"No Excel files found in {self.directory_path}")
        
        # Process each file and build the configuration
        complete_config = {}
        
        for excel_file in excel_files:
            logger.info("Processing workbook metadata")
            
            file_config = self._process_excel_file(excel_file)
            
            if file_config:
                complete_config.update(file_config)
        
        return complete_config
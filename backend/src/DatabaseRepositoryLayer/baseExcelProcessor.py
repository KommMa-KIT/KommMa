"""
Base Excel Processor
====================
Provides common, low-level utilities for reading and navigating Excel files.

Why this exists
---------------
Several repositories (MetaDataExtractor, ReferenceCommuneRepository, etc.) need to
read fixed-layout Excel sheets.  Extracting that logic into a shared base class
avoids duplication and creates a single place to adapt if the Excel layout or the
underlying library (currently *pandas* / *openpyxl*) ever changes.

Scalability
-----------
Because every concrete repository inherits from ``BaseExcelProcessor``, replacing
Excel files with a relational database only requires overriding these low-level
helpers -- the higher-level business logic in each repository remains untouched.

Thread Safety
-------------
Instances are **not** thread-safe by default.  Each request should either create
its own processor or protect shared instances with external synchronisation.
"""

import pandas as pd
from pathlib import Path
from typing import Any


class BaseExcelProcessor:
    """
    Shared base class for reading fixed-layout Excel workbooks.

    Encapsulates cell-addressing conventions, key normalisation, and file
    discovery so that concrete repositories only express *what* to extract,
    not *how* to navigate a spreadsheet.

    Subclasses override ``data_sheet_index`` or the column / row constants
    to match their specific workbook layout.
    """
    
    def __init__(self, data_sheet_index: int = 2):
        """
        Initialise the processor with workbook-layout constants.

        @param data_sheet_index: Zero-based index of the primary data sheet.
                                 Default is ``2`` (the third sheet), matching
                                 the current Excel template convention.
        """
        self.data_sheet_index = data_sheet_index
        self.data_start_row = 6  # Row 6 in Excel (index 5 in pandas)
        self.category_col = "B"  # Column B has category names
        self.value_col = "F"     # Column F has values
        self.commune_id_cell = "B2"
        self.commune_name_cell = "B3"
    
    
    def _read_cell_value(self, df: pd.DataFrame, cell_reference: str) -> Any:
        """
        Read a single value by its Excel-style cell reference.

        Translates a human-readable reference like ``"B2"`` into pandas
        row/column indices so callers can work with familiar spreadsheet
        coordinates.

        @param df:             DataFrame loaded from the target sheet
                               (header=None, so rows are 0-indexed).
        @param cell_reference: Excel cell address, e.g. ``"B2"`` or ``"F6"``.

        @return: The scalar value at that cell, or ``None`` if the
                 coordinates are out of bounds.
        """
        # Convert Excel cell reference to pandas indices
        col_letter = ''.join(filter(str.isalpha, cell_reference))
        row_number = int(''.join(filter(str.isdigit, cell_reference)))
        
        # Convert column letter to index (A=0, B=1, etc.)
        col_index = ord(col_letter.upper()) - ord('A')
        row_index = row_number - 1  # Excel rows are 1-indexed
        
        try:
            return df.iloc[row_index, col_index]
        except (IndexError, KeyError):
            return None
    
    
    def _column_index_to_letter(self, index: int) -> str:
        """
        Convert a 0-based column index to an Excel column letter.

        Handles multi-letter columns (``AA``, ``AB``, ...) so the caller
        does not need to hard-code letter arithmetic.

        @param index: Zero-based column index (0 -> A, 25 -> Z, 26 -> AA).

        @return: Upper-case column letter string.
        """
        result = ""
        while index >= 0:
            result = chr(index % 26 + ord('A')) + result
            index = index // 26 - 1
        return result
    
    
    def _clean_key(self, text: str) -> str:
        """
        Normalise raw Excel text into a stable, machine-friendly identifier.

        The resulting key is lower-case with spaces and hyphens replaced by
        underscores -- suitable for JSON keys, dictionary look-ups, and
        cross-file matching.

        @param text: Raw category or header text from an Excel cell.

        @return: Cleaned identifier string (e.g. ``"kommunaler_haushalt"``).
        """
        return text.lower().strip().replace(' ', '_').replace('-', '_')
    
    
    def _read_data_section(self, df: pd.DataFrame) -> dict:
        """
        Discover the data-category rows in a standardised Excel sheet.

        Iterates column B starting at ``data_start_row`` (row 6 by default)
        until an empty cell signals the end of the section.  For every
        non-empty category it records the 1-based Excel row number, which
        downstream code uses to build cell references (e.g. ``"F6"``) for
        value injection or extraction.

        @param df: DataFrame of the data sheet (loaded with ``header=None``).

        @return: ``{cleaned_category_name: excel_row_number, ...}``
        """
        data_section = {}
        
        # Start from row 6 (index 5)
        row_index = self.data_start_row - 1
        
        while row_index < len(df):
            # Read category from column B
            category = self._read_cell_value(df, f"B{row_index + 1}")
            
            # Stop at empty category
            if pd.isna(category) or str(category).strip() == "":
                break
            
            category_clean = self._clean_key(str(category))
            
            # Store the row number for this category
            data_section[category_clean] = row_index + 1  # Excel row number
            
            row_index += 1
        
        return data_section
    
    
    def _extract_id_and_name(self, df: pd.DataFrame) -> tuple:
        """
        Extract the entity identifier and human-readable name from the sheet header.

        By convention, cell **B2** holds the ID (e.g. a measure code) and
        cell **B3** holds the display name.  Both values are stripped of
        surrounding whitespace.

        @param df: DataFrame of the sheet (loaded with ``header=None``).

        @return: ``(id_string, name_string)`` or ``(None, None)`` if
                 either cell is empty / NaN.
        """
        # Extract ID from B2
        id_value = self._read_cell_value(df, self.commune_id_cell)
        
        # Extract name from B3
        name_value = self._read_cell_value(df, self.commune_name_cell)
        
        # Validate that we found both
        if pd.isna(id_value) or pd.isna(name_value):
            return None, None
        
        # Clean the values
        id_clean = str(id_value).strip()
        name_clean = str(name_value).strip()
        
        return id_clean, name_clean
    
    
    def _find_excel_files(self, directory: Path) -> list:
        """
        List all processable ``.xlsx`` files in *directory*.

        Temporary lock-files created by Excel (prefixed with ``~$``) are
        automatically excluded to avoid read errors during concurrent
        editing.

        @param directory: Folder to scan (non-recursive).

        @return: List of ``Path`` objects for each valid Excel file.
        """
        # Find all Excel files in the directory
        excel_files = list(directory.glob("*.xlsx"))
        
        # Filter out temporary files (starting with ~$)
        excel_files = [f for f in excel_files if not f.name.startswith("~$")]
        
        return excel_files
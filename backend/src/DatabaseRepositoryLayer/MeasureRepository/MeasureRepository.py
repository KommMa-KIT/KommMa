"""
MeasuresInformationExtractor
============================
Extracts the **measure catalogue** -- the descriptive metadata for every
climate-protection measure (title, description, image URL, popularity, etc.).

Business Purpose
----------------
The frontend needs a human-readable catalogue to display measure cards,
filterable lists, and detail views.  This extractor reads a single
multi-sheet Excel file where each sheet describes one measure, and returns
a uniform list of dictionaries with standardised field names.

Architecture
------------
Inherits from ``MultiSheetInfoExtractor`` (shared sheet-iteration logic)
and implements ``MeasureDataSource`` (``ApplicationLayer.DataApi.interfaces``).
The application layer therefore depends only on the protocol, not on this
concrete Excel-backed implementation.

Scalability
-----------
Because ``get_all_measures()`` returns plain dictionaries, the result can
be cached in Redis or persisted in a database.  Replacing the Excel file
with a database table requires only a new ``MeasureDataSource``
implementation.

Thread Safety
-------------
Instances are stateless after construction; ``get_all_measures()`` performs
a fresh file read each time and is safe for concurrent use.
"""

import sys
import pandas as pd

from pathlib import Path
from typing import List, Dict, Any

from DatabaseRepositoryLayer.multiSheetInfoExtractor import MultiSheetInfoExtractor
from ApplicationLayer.DataApi.interfaces import MeasureDataSource

# Add src directory to Python path to enable imports (e.g. config)
src_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(src_dir))



class MeasuresInformationExtractor(MultiSheetInfoExtractor, MeasureDataSource):
    """
    Concrete extractor for the measure-catalogue Excel file.

    Each sheet (starting from sheet index 1) represents a single measure.
    The first two characters of the sheet name are stripped to derive the
    measure ID; the remaining content of the first row provides the
    measure's descriptive attributes.

    Field-name mapping (``FIELD_MAPPING``) translates raw Excel column
    headers to the canonical keys expected by the frontend.
    """
    
    # Map Excel column names to desired JSON field names
    FIELD_MAPPING = {
        'socialAcceptance': 'popularity',
        'socialAcceptanceComment': 'popularityComment',
        'shortDescription': 'shortDescription',
        'description': 'description',
        'relevantParameters': 'relevantParameters',
        'furtherInfo': 'furtherInfo',
        'imageURL': 'imageURL',
        'titel': 'titel'
    }
    
    def __init__(self, file_path: str):
        """
        Bind the extractor to a specific measures Excel file.

        The first sheet (index 0) is assumed to be a legend / summary and
        is automatically skipped.

        @param file_path: Absolute or relative path to the ``.xlsx`` file.
        """
        # Skip first sheet (index 0) by starting at index 1
        super().__init__(file_path, id_prefix_length=2, sheet_start_index=1)
    
    def _extract_entity_from_sheet(self, sheet_name: str, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Build a measure dict from one sheet, applying field-name mapping.

        Comma-separated strings in ``relevantParameters`` and ``furtherInfo``
        are automatically split into Python lists so the frontend receives
        arrays instead of raw CSV text.

        @param sheet_name: Name of the Excel sheet (ID prefix stripped).
        @param df:         DataFrame of the sheet (first row holds attributes).

        @return: Measure dictionary with mapped field names and an ``"id"``
                 key.
        """
        # Extract ID from sheet name (skip prefix characters)
        entity_id = sheet_name[self.id_prefix_length:] if len(sheet_name) > self.id_prefix_length else sheet_name
        
        # Start with ID, then process Excel columns in their natural order
        result = {'id': entity_id}
        
        # Process each column in order (preserves Excel column order)
        for excel_field, value in df.iloc[0].items():
            # Map to desired field name, or keep original if not in mapping
            desired_field = self.FIELD_MAPPING.get(excel_field, excel_field)
            
            # Convert comma-separated strings to lists for specific fields
            if desired_field in ['relevantParameters', 'furtherInfo'] and isinstance(value, str):
                value = [item.strip() for item in value.split(',') if item.strip()]
            
            result[desired_field] = value
        
        return result
    
    def get_all_measures(self) -> List[Dict[str, Any]]:
        """
        Public entry point: return every measure in the catalogue.

        Satisfies the ``MeasureDataSource`` protocol.

        @return: List of measure dicts, each containing at least ``"id"``,
                 ``"titel"``, ``"shortDescription"``, and
                 ``"relevantParameters"``.

        @throws FileNotFoundError: If the workbook file does not exist.
        @throws ValueError:        If the data structure is invalid.
        """
        return self.get_all()
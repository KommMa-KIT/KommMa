"""
Multi-Sheet Information Extractor
=================================
Generic base class for extracting structured entities from Excel workbooks
where **each sheet represents one entity** (measure, commune, etc.).

Why this exists
---------------
Several domain concepts (measures, reference communes) are stored as
multi-sheet Excel files with a uniform layout.  This base class captures
the sheet-iteration and ID-extraction logic once, so concrete extractors
(e.g. ``MeasuresInformationExtractor``) only need to define field-mapping
rules.

Scalability
-----------
If the backing store changes from Excel to a database, a new implementation
of ``get_all()`` can query tables instead of sheets while keeping the same
public contract.

Thread Safety
-------------
Instances are stateless after construction (no mutable shared state) and
are therefore safe to share across threads for read-only access.
"""

import pandas as pd
from typing import List, Dict, Any


class MultiSheetInfoExtractor:
    """
    Generic extractor for workbooks whose sheets each describe one entity.

    The sheet name encodes the entity ID (optionally prefixed with a fixed
    number of characters that are stripped), and the first data row of each
    sheet provides the entity attributes as key-value pairs.

    Subclasses may override ``_extract_entity_from_sheet`` to apply custom
    field-name mapping or value transformations.
    """
    
    def __init__(self, file_path: str, id_prefix_length: int = 2, sheet_start_index: int = 0):
        """
        Configure the extractor for a specific workbook layout.

        @param file_path:         Absolute or relative path to the ``.xlsx`` file.
        @param id_prefix_length:  Number of leading characters to strip from each
                                  sheet name to obtain the entity ID.
                                  E.g. ``2`` turns ``"M_20106"`` into ``"20106"``.
        @param sheet_start_index: Zero-based index of the first sheet to process.
                                  Use ``1`` to skip a summary / legend sheet.
        """
        self.file_path = file_path
        self.id_prefix_length = id_prefix_length
        self.sheet_start_index = sheet_start_index
    
    def _extract_entity_from_sheet(self, sheet_name: str, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Build an entity dictionary from a single sheet.

        The default implementation reads the first row as key-value pairs and
        prepends an ``"id"`` field derived from the sheet name.  Subclasses
        override this method to apply field-name mapping or type coercion.

        @param sheet_name: Name of the Excel sheet (used to derive the ID).
        @param df:         DataFrame containing all rows of the sheet.

        @return: Dictionary with at least an ``"id"`` key, plus all columns
                 from the first row.
        """
        # Extract ID from sheet name (skip prefix characters)
        if len(sheet_name) > self.id_prefix_length:
            entity_id = sheet_name[self.id_prefix_length:].lower()
        else:
            entity_id = sheet_name.lower()
        
        # Convert first row to dictionary
        entity_dict = df.iloc[0].to_dict()
        
        # Add the ID to the dictionary at the start
        entity_dict = {'id': entity_id, **entity_dict}
        
        return entity_dict
    
    def _process_all_sheets(self) -> List[Dict[str, Any]]:
        """
        Iterate over every relevant sheet and extract its entity.

        Sheets before ``sheet_start_index`` and empty sheets are silently
        skipped.

        @return: List of entity dictionaries, one per non-empty sheet.

        @throws FileNotFoundError: If the workbook file does not exist.
        @throws ValueError:        If the file cannot be read or parsed.
        """
        entities = []
        
        try:
            # Read all sheets from the Excel file
            complete_file = pd.read_excel(self.file_path, sheet_name=None)
            
            # Convert to list to enable slicing from sheet_start_index
            sheet_items = list(complete_file.items())
            
            for sheet_name, df in sheet_items[self.sheet_start_index:]:
                # Skip empty sheets
                if df.empty:
                    continue
                
                # Extract entity information from this sheet
                entity_dict = self._extract_entity_from_sheet(sheet_name, df)
                entities.append(entity_dict)
            
            return entities
            
        except FileNotFoundError:
                raise FileNotFoundError("Excel file not found")
        except Exception as e:
            raise ValueError(f"Error reading Excel file: {e}")
    
    def get_all(self) -> List[Dict[str, Any]]:
        """
        Public entry point: return every entity found in the workbook.

        This is the method consumed by the application layer; it delegates
        to ``_process_all_sheets`` and may be wrapped with caching or
        validation in subclasses.

        @return: List of entity dictionaries, each containing at least
                 an ``"id"`` field.

        @throws FileNotFoundError: If the workbook file does not exist.
        @throws ValueError:        If the data structure is invalid.
        """
        return self._process_all_sheets()

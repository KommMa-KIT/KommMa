"""
ReferenceCommuneRepository
==========================
Provides **pre-filled input sets** for reference (demo) communes so that
users can explore the tool without entering all data manually.

Business Purpose
----------------
Reference communes are curated example municipalities whose input parameters
are stored in Excel sub-directories.  This repository reads those parameters
and returns them in the same ``{id, value}`` format that the frontend form
produces, enabling one-click pre-fill.

Data Sources
    - ``ReferenceCommuneCalculationSheets/<CommuneName>/*.xlsx``
      -- per-commune input values (same layout as calculation sheets).
    - ``ReferenceCommuneInformationSheet.xlsx``
      -- catalogue with name, population, and description for each commune.

Architecture
------------
Inherits from ``BaseExcelProcessor`` (cell-reading utilities) and implements
``ReferenceCommuneDataSource`` (``ApplicationLayer.DataApi.interfaces``).
The application layer depends only on the protocol, so a database-backed
implementation can replace this class transparently.

Scalability
-----------
Results are cached per commune name in ``commune_data_cache``.  Adding a
new reference commune is a zero-code operation: simply drop a new
sub-directory with the commune's Excel files.

Thread Safety
-------------
The cache (plain ``dict``) is safe under asyncio's single-threaded model.
For true multi-threaded access, wrap cache reads/writes with a lock.
"""

import sys
import re
import pandas as pd
import logging

from typing import Dict, Any, List, Optional
from pathlib import Path


from DatabaseRepositoryLayer.baseExcelProcessor import BaseExcelProcessor
from ApplicationLayer.DataApi.interfaces import ReferenceCommuneDataSource


# Add src directory to Python path to enable imports
src_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(src_dir))



logger = logging.getLogger(__name__)


class ReferenceCommuneRepository(BaseExcelProcessor, ReferenceCommuneDataSource):
    """
    Repository for reference commune data (pre-fill values and catalogue info).

    Two distinct data paths are supported:
        1. **Prefill path** -- reads Excel files from per-commune sub-directories
           to extract the input values (requires ``commune_directory``).
        2. **Info path** -- reads a single catalogue workbook to list all
           communes with name, population, and description (requires
           ``info_file_path``).

    Either path may be used independently, so both constructor parameters
    are optional.
    """
    
    def __init__(
        self,
        commune_directory: str = "",
        data_sheet_index: int = 2,
        info_file_path: Optional[str] = None
    ):
        """
        Initialise the repository with paths to the data sources.

        @param commune_directory: Root folder containing one sub-directory per
                                  reference commune.  Optional -- only required
                                  when using ``get_reference_commune_prefill()``.
        @param data_sheet_index:  Zero-based sheet index for input data
                                  (default: ``2``).
        @param info_file_path:    Path to the catalogue workbook with commune
                                  name / population / description.  Optional --
                                  only required for
                                  ``list_all_reference_communes_info()``.

        @throws FileNotFoundError: If *commune_directory* is non-empty and
                                   does not exist on disk.
        """
        super().__init__(data_sheet_index=data_sheet_index)
        
        # Only validate directory if it's provided and will be used for prefill
        if commune_directory:
            self.commune_directory = Path(commune_directory)
            
            # Validate directory
            if not self.commune_directory.exists():
                raise FileNotFoundError(f"Commune directory not found: {commune_directory}")
        else:
            self.commune_directory = None
        
        # Store info file path (for list_all_reference_communes_info method)
        self.info_file_path = Path(info_file_path) if info_file_path else None
        
        # Cache for commune data
        self.commune_data_cache: Dict[str, Dict[str, Any]] = {}
        
        logger.info(
            "ReferenceCommuneRepository initialized (commune_directory=%s, info_file=%s)",
            bool(self.commune_directory),
            bool(self.info_file_path),
        )
    
    
    def _get_commune_directories(self) -> Dict[str, Path]:
        """
        Discover all commune sub-directories under ``commune_directory``.

        Each immediate child directory is treated as a commune whose name
        equals the directory name.

        @return: ``{commune_name: Path, ...}``.
        """
        communes = {}
        
        # Check if commune_directory is set
        if self.commune_directory is None:
            logger.error("Error scanning commune directories: commune_directory is not set")
            return communes
        
        try:
            for item in self.commune_directory.iterdir():
                if item.is_dir():
                    # Use directory name as commune name
                    commune_name = item.name
                    communes[commune_name] = item
        
        except Exception as e:
            logger.error("Error scanning commune directories")
        
        return communes
    
    
    def load_all_communes(self) -> List[str]:
        """
        List the names of all available reference communes.

        Useful for populating a selection dropdown before the user
        requests a specific commune's data.

        @return: Alphabetically sorted list of commune names
                 (directory names).
        """
        logger.info("Loading all available reference communes...")
        
        communes = self._get_commune_directories()
        
        if not communes:
            logger.warning("No commune directories found")
            return []
        
        commune_names = sorted(communes.keys())
        logger.info("Found %d reference communes", len(commune_names))
        
        return commune_names
    
    
    def _convert_to_camel_case(self, snake_case_str: str) -> str:
        """
        Convert a snake_case identifier to camelCase.

        Parenthesised segments are handled specially so that
        ``durchschnittliche_abwassermenge_(ohne_regenwasser)`` becomes
        ``durchschnittlicheAbwassermenge(ohneRegenwasser)``.

        @param snake_case_str: Identifier in snake_case format.

        @return: camelCase string.
        """
        if not snake_case_str or '_' not in snake_case_str:
            return snake_case_str
        
        # First, handle parentheses - remove underscores around them
        # durchschnittliche_abwassermenge_(ohne_regenwasser) 
        # -> durchschnittliche_abwassermenge(ohne_regenwasser)
        result = snake_case_str.replace('_(', '(').replace('_)', ')')
        
        # Now we need to handle the parts between/around parentheses separately
        # Split on parentheses while keeping them
        parts = re.split(r'([()])', result)
        
        converted_parts = []
        for part in parts:
            if part in ('(', ')'):
                # Keep parentheses as-is
                converted_parts.append(part)
            elif part:
                # Convert snake_case to camelCase for this part
                words = part.split('_')
                if words:
                    # First word stays lowercase, rest get capitalized
                    camel = words[0] + ''.join(word.capitalize() for word in words[1:])
                    converted_parts.append(camel)
        
        return ''.join(converted_parts)
    
    
    def _extract_commune_data(self, commune_path: Path) -> Dict[str, Any]:
        """
        Read the actual input values from all Excel files in a commune directory.

        Each file's data sheet is scanned for category rows; the corresponding
        values in column F are extracted and returned using camelCase keys.

        @param commune_path: Directory containing the commune's ``.xlsx`` files.

        @return: ``{camelCaseParamName: value, ...}``.
        """
        commune_data = {}
        
        # Find Excel files in the commune directory
        excel_files = self._find_excel_files(commune_path)
        
        if not excel_files:
            logger.warning("No Excel files found in configured commune directory")
            return commune_data
        
        # Process each Excel file to extract data
        for excel_file in excel_files:
            try:
                df_data = pd.read_excel(excel_file, sheet_name=self.data_sheet_index, header=None)
                
                # Read data section
                data_section = self._read_data_section(df_data)
                
                # For each category, read the actual value from column F
                for category_clean, row_number in data_section.items():
                    value = self._read_cell_value(df_data, f"F{row_number}")
                    
                    # Convert ID to camelCase format
                    category_camel = self._convert_to_camel_case(category_clean)
                    
                    # Store the value (convert to appropriate type)
                    if pd.isna(value):
                        commune_data[category_camel] = None
                    elif isinstance(value, (int, float)):
                        commune_data[category_camel] = value
                    else:
                        # Try to convert string to number if possible
                        try:
                            commune_data[category_camel] = float(value)
                        except (ValueError, TypeError):
                            commune_data[category_camel] = str(value)
            
            except Exception as e:
                logger.warning("Error reading commune data workbook")
                continue
        
        return commune_data
    
    
    def _format_inputs_list(self, commune_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Convert the flat value dict into the ``[{id, value}]`` list format.

        Parameters whose value is ``None`` are silently dropped so the
        frontend only receives entries it can display.

        @param commune_data: ``{param_name: value, ...}`` dict.

        @return: ``[{"id": name, "value": val}, ...]``.
        """
        inputs = []
        
        for param_id, param_value in commune_data.items():
            if param_value is not None:  # Skip None values
                inputs.append({
                    "id": param_id,
                    "value": param_value
                })
        
        return inputs
    
    
    def get_reference_commune_prefill(self, commune_name: str) -> Dict[str, Any]:
        """
        Return pre-fill data for a specific reference commune.

        Satisfies the ``ReferenceCommuneDataSource`` protocol.

        The result is cached after the first call for each commune name
        to avoid repeated file I/O.

        @param commune_name: Directory name of the commune
                             (e.g. ``"Wiesenhall"``).

        @return: ``{"id": name, "name": name, "inputs": [{"id": ..., "value": ...}, ...]}``.

        @throws ValueError:        If *commune_name* is invalid or not found.
        @throws FileNotFoundError: (indirect) If the commune directory or
                                   its Excel files are missing.
        """
        # Validate that commune_directory is set
        if self.commune_directory is None:
            logger.error("commune_directory is not set. Cannot retrieve reference commune data.")
            raise ValueError("Reference commune directory is not configured. Please check the repository initialization.")
        
        # Handle invalid commune names
        if not commune_name or commune_name.lower() in ['undefined', 'null', 'none']:
            logger.warning("Invalid commune name received")
            raise ValueError(f"Invalid commune name: '{commune_name}'. Please provide a valid reference commune name.")
        
        # Check cache first
        if commune_name in self.commune_data_cache:
            logger.debug("Cache HIT for requested commune")
            return self.commune_data_cache[commune_name]
        
        # Find the commune directory
        communes = self._get_commune_directories()
        
        if commune_name not in communes:
            raise ValueError("Requested reference commune not found.")
        
        commune_path = communes[commune_name]
        logger.info("Extracting reference commune input data")
        
        # Extract all input data from Excel files
        commune_data = self._extract_commune_data(commune_path)
        
        logger.info("Extracted %d parameters for requested commune", len(commune_data))
        
        # Format as inputs list
        inputs_list = self._format_inputs_list(commune_data)
        
        # Build result in the format expected by frontend
        result = {
            "id": commune_name,
            "name": commune_name,
            "inputs": inputs_list
        }
        
        # Cache the result
        self.commune_data_cache[commune_name] = result
        
        logger.info("Successfully prepared %d prefill inputs", len(inputs_list))
        
        return result
    
    
    def list_all_reference_communes_info(self) -> List[Dict[str, Any]]:
        """
        Return the catalogue of all reference communes with metadata.

        Satisfies the ``ReferenceCommuneDataSource`` protocol.  Reads the
        information sheet (second sheet of the configured workbook) which
        must contain columns ``name``, ``population``, and ``description``.

        @return: List of dicts, each with ``id``, ``name``, ``population``,
                 and ``description``.

        @throws ValueError:        If ``info_file_path`` is not configured
                                   or the file lacks required columns.
        @throws FileNotFoundError: If the info workbook is missing.
        """
        logger.info("Loading reference commune information from Excel file")
        
        # Check if info_file_path is configured
        if not self.info_file_path:
            logger.error("No info_file_path provided")
            raise ValueError("Reference commune info file path is not configured. Please check the repository initialization.")
        
        # Check if file exists
        if not self.info_file_path.exists():
            logger.error("Reference commune info workbook not found")
            raise FileNotFoundError("Reference commune info workbook not found")
        
        try:
            # Read Excel file (second sheet, row 1 as header)
            df = pd.read_excel(self.info_file_path, sheet_name=1, header=0)
            
            # Verify expected columns exist
            expected_columns = ['name', 'population', 'description']
            if not all(col in df.columns for col in expected_columns):
                logger.error("Reference commune info workbook has invalid structure")
                raise ValueError(f"Excel file must have columns: {expected_columns}")
            
            # Build list of commune info
            communes_info = []
            
            for _, row in df.iterrows():
                name = row['name']
                population = row['population']
                description = row['description']
                
                # Skip rows with missing name
                if pd.isna(name):
                    continue
                
                # Convert to appropriate types
                name = str(name).strip()
                population = int(population) if not pd.isna(population) else 0
                description = str(description).strip() if not pd.isna(description) else ""
                
                commune_info = {
                    "id": name,  # id is the same as name
                    "name": name,
                    "population": population,
                    "description": description
                }
                
                communes_info.append(commune_info)
            
            logger.info(f"Successfully loaded {len(communes_info)} reference communes")
            
            return communes_info
        
        except Exception as e:
            logger.error("Error reading reference commune info workbook")
            raise

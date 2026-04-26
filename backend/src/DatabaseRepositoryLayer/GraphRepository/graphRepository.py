"""
GraphRepository
===============
Extracts a **measure-to-measure relationship graph** from an Excel adjacency
matrix and converts it into an edge-list format suitable for graph
visualisation on the frontend.

Business Purpose
----------------
Climate-protection measures can reinforce (synergy), conflict with, or
depend on one another.  The adjacency matrix stored in Excel encodes these
relationships using single-letter codes (S, K, A, B, N).  This repository
transforms the raw matrix into a clean edge list that the frontend graph
component consumes directly.

Architecture
------------
Implements ``GraphDataSource`` (``ApplicationLayer.DataApi.interfaces``),
so the business layer never depends on the Excel backing store.  A future
migration to a graph database (e.g. Neo4j) would only require a new
``GraphDataSource`` implementation.

Thread Safety
-------------
Each call to ``get_graph()`` performs its own file read and DataFrame
processing; there is no mutable shared state between calls.
"""

import sys
import pandas as pd


from typing import List, Dict
from pathlib import Path

from ApplicationLayer.DataApi.interfaces import GraphDataSource

# Add src directory to Python path to enable imports (e.g. config)
src_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(src_dir))


class GraphRepository(GraphDataSource):
    """
    Reads an Excel adjacency matrix and exposes it as a typed edge list.

    The complete pipeline (read -> clean -> convert -> filter) is executed
    inside ``get_graph()`` and produces a list of ``{from, to, type}``
    dicts ready for JSON serialisation.
    """
    
    def __init__(self, file_path: str):
        """
        Bind the repository to a specific Excel file.

        @param file_path: Absolute or relative path to the ``.xlsx`` file
                          that holds the adjacency matrix.
        """
        self.file_path = file_path
        self.relation_mapping = {
            'S': 'synergy',
            'K': 'conflict',
            'A': 'dependency',
            'B': 'prerequisite',
            'N': 'neutral'
        }
    
    def _extract_relations_matrix(self) -> pd.DataFrame:
        """
        Read and clean the adjacency matrix from the Excel file.

        The method dynamically discovers the matrix boundaries by searching
        for the ``ID_neu`` header row, so it tolerates layout variations
        between file revisions.

        @return: Square DataFrame with measure IDs as both index and columns,
                 cell values being single-letter relation codes.

        @throws FileNotFoundError: If the Excel file is missing.
        @throws ValueError:        If the expected ``ID_neu`` column or
                                   matrix structure cannot be found.
        """
        try:
            # Load the complete workbook without assuming headers
            complete_df = pd.read_excel(self.file_path, header=None)
            
            # Find the row that contains 'ID_neu' - this is our header row
            header_row_idx = None

            for idx, row in complete_df.iterrows():
                if 'ID_neu' in row.values:
                    header_row_idx = idx
                    break
            
            if header_row_idx is None:
                raise ValueError("'ID_neu' not found in the Excel file")
            
            # Read the file again with proper header
            df_with_header = pd.read_excel(self.file_path, header=header_row_idx)
            
            # Find where the actual matrix starts (after ID_neu column)
            matrix_start_col = None
            for col_idx, col_name in enumerate(df_with_header.columns):
                if col_idx > 0 and col_name != 'ID_neu' and pd.notna(col_name):
                    if str(col_name).strip():
                        matrix_start_col = col_idx
                        break
            
            if matrix_start_col is None:
                raise ValueError("Could not identify matrix start column")
            
            # Filter to only rows that have a valid ID_neu value
            valid_data = df_with_header[df_with_header['ID_neu'].notna()].copy()
            
            # Remove any rows where ID_neu is empty string after stripping
            valid_data['ID_neu'] = valid_data['ID_neu'].astype(str).str.strip()
            valid_data = valid_data[valid_data['ID_neu'] != '']
            
            if valid_data.empty:
                raise ValueError("No valid data rows found with ID_neu values")
            
            # Set ID_neu as index
            valid_data = valid_data.set_index('ID_neu')
            
            # Get all column names that represent the matrix
            valid_ids = set(valid_data.index.tolist())
            
            # Find columns that match IDs (this creates the square adjacency matrix)
            matrix_columns = [col for col in valid_data.columns if col in valid_ids]
            
            if not matrix_columns:
                # Fallback: use all columns after the first few metadata columns
                matrix_columns = valid_data.columns[matrix_start_col-1:].tolist()
            
            # Extract only the adjacency matrix columns
            adjacency_matrix = valid_data[matrix_columns]
            
            return adjacency_matrix
            
        except FileNotFoundError:
                raise FileNotFoundError("Excel file not found")
        except Exception as e:
            raise ValueError(f"Error extracting relations matrix: {e}")
    
    def _adjacency_to_edge_list(self, adjacency_matrix: pd.DataFrame) -> pd.DataFrame:
        """
        Convert the adjacency matrix to a flat edge list.

        Processing steps:
            1. Stack the matrix into (source, target, code) triples.
            2. Clean and upper-case the relation codes.
            3. Filter out invalid / undefined entries.
            4. Map single-letter codes to full names (S -> synergy, etc.).
            5. Remove neutral relationships (they carry no actionable info
               for the frontend graph).

        @param adjacency_matrix: Square DataFrame produced by
                                 ``_extract_relations_matrix``.

        @return: DataFrame with columns ``from``, ``to``, ``type``.
        """
        # Stack the matrix to create (source, target) pairs
        # Only include non-null values
        edge_list = adjacency_matrix.stack().reset_index()
        
        # Rename columns to the desired format
        edge_list.columns = ['from', 'to', 'type']
        
        # Clean and standardize the data
        edge_list['from'] = edge_list['from'].astype(str).str.strip()
        edge_list['to'] = edge_list['to'].astype(str).str.strip()
        edge_list['type'] = edge_list['type'].astype(str).str.upper().str.strip()
        
        # Remove rows with invalid data
        invalid_values = ['NICHT DEFINIERT', 'NAN', 'NONE', '']
        edge_list = edge_list[~edge_list['type'].isin(invalid_values)]
        
        # Also remove any rows where from or to are empty
        edge_list = edge_list[
            (edge_list['from'] != '') & 
            (edge_list['to'] != '')
        ]
        
        # Take only the first character of the relation type
        edge_list['type'] = edge_list['type'].str[0]
        
        # Map relation type codes to full names
        edge_list['type'] = edge_list['type'].map(self.relation_mapping)
        
        # Remove any rows where the mapping failed (unknown relation types)
        edge_list = edge_list.dropna(subset=['type'])
        
        # Filter out neutral relationships from the output
        edge_list = edge_list[edge_list['type'] != 'neutral']
        
        return edge_list
    
    def get_graph(self) -> List[Dict[str, str]]:
        """
        Public entry point: extract the full relationship graph.

        Satisfies the ``GraphDataSource`` protocol.

        @return: List of edge dicts, e.g.
                 ``[{"from": "20101", "to": "20102", "type": "synergy"}, ...]``.
                 Neutral relationships are excluded.

        @throws FileNotFoundError: If the Excel file is missing.
        @throws ValueError:        If the data structure is invalid.
        """
        # Extract and clean the adjacency matrix
        adjacency_matrix = self._extract_relations_matrix()
        
        # Convert to edge list
        edge_list_df = self._adjacency_to_edge_list(adjacency_matrix)
        
        # Convert to list of dictionaries for JSON serialization
        edge_list = edge_list_df.to_dict(orient='records')
        
        return edge_list
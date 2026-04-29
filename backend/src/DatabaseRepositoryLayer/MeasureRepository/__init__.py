"""
MeasureRepository
=================
Catalogue of available climate-protection measures (descriptive metadata).

Key classes
    MeasuresInformationExtractor      -- base catalogue from Excel
                                         (implements ``MeasureDataSource``).
    ScenarioAwareMeasureDataSource    -- decorator that expands base measures
                                         with reference-scenario variants
                                         (also implements ``MeasureDataSource``).
"""

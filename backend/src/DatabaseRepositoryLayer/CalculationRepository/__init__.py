"""
CalculationRepository
=====================
Formula-based measure-calculation engine.

Key classes
    CalculationRepository -- core pipeline (metadata + engine + cache).
    CalculationAPI        -- facade consumed by FastAPI routes
                             (implements ``ICalculationEngine``).
    MetaDataExtractor     -- startup scan that maps Excel cells to
                             parameters and results.

Internal sub-packages
    engine/         -- ``FormulaEngine`` wrapping the ``formulas`` library.
    preprocessing/  -- ``StructuredRefResolver`` for rewriting table refs.
"""

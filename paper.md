---
title: 'KommMa: An Open-Source Decision-Support Tool for Prioritizing Municipal Climate Mitigation Measures'
tags:
  - Python
  - React
authors:
  - name: Kushagra Chopda 
    equal-contrib: true
    affiliation: 1
  - name: Jonas Dorner
    equal-contrib: true
    affiliation: 1
  - name: Yannic Flad
    email: flad.yannic@gmail.com
    equal-contrib: true
    corresponding: true
    affiliation: 1
  - name: David Höfler 
    equal-contrib: true
    affiliation: 1
  - name: Micha Ludwig
    equal-contrib: true
    affiliation: 1
  - name: Sara Dicks
    affiliation: 1,2
  - name: Janus Willem Schipper
    affiliation: 1,2

affiliations:
 - name: Karlsruhe Institute of Technology (KIT)
   index: 1
 - name: South German Climate Office at KIT
   index: 2

bibliography: kommMa_JOSS.bib

date: 11 August 2026

---

# Summary
KommMa is an open-source decision-support tool for municipal climate action planning. Implemented in Python as a web application, the software supports the assessment and prioritization of climate mitigation measures in energy, mobility, and water and wastewater management. KommMa is based on a scientifically developed knowledge base that describes climate mitigation measures using a set of comparable evaluation criteria and explicitly represents interdependencies among measures, including synergies, conflicts, and implementation dependencies.

The software combines this knowledge base with municipality-specific data to estimate greenhouse gas emission reductions, implementation costs, implementation time, and selected social indicators. Based on these assessments, KommMa generates prioritized mitigation portfolios and provides traceable explanations of the underlying evaluation process. The software was developed at the Karlsruhe Institute of Technology (KIT) in collaboration with municipal utilities, climate and energy agencies, and municipal associations. KommMa supports cross-sector analyses and the translation of municipal climate targets into locally tailored mitigation strategies.

# Statement of need
Municipalities play a central role in climate mitigation, yet many lack the analytical capacity to develop coherent and evidence-based mitigation strategies [@kern2023]. This challenge is particularly pronounced in small and medium-sized municipalities, where climate managers often operate with limited financial and personnel resources, face a variety of organizational barriers to climate action [@Otto2025] and therefore rely on external studies and consulting services. Because these analyses frequently employ different methodologies, their results are not always directly comparable or reproducible. Consequently, local climate action planning often depends on fragmented information and expert judgement rather than transparent and context-specific assessments.

Existing digital tools provide valuable support for greenhouse gas accounting and climate monitoring, while decision-support systems help address complex planning problems [@Rezvani2023]. However, existing tools for municipal climate management offer limited assistance when municipalities need to compare and prioritize mitigation measures. Most solutions focus on documenting current conditions and tracking progress rather than supporting strategic decision-making. In particular, they rarely represent how mitigation measures interact with one another, making it difficult to assess potential synergies, identify conflicts, or account for implementation dependencies. As a result, municipalities have limited support for evaluating alternative mitigation pathways and selecting context-specific measures [@Kopp2026].

KommMa addresses this gap by combining a knowledge base of scientifically assessed climate mitigation measures with municipality-specific data within a unified analytical framework. The software explicitly models interactions among measures and applies a common set of evaluation criteria across the energy, mobility, and water and wastewater sectors. This enables cross-sector analyses of municipal mitigation strategies. KommMa supports evidence-based prioritization of climate actions and research on the effectiveness, interactions, and implementation characteristics of municipal mitigation measures.

# State of the field                 
Municipal climate planning is supported by a broad range of digital tools, planning resources, and analytical methods. Existing software is primarily designed for greenhouse gas accounting and progress monitoring [@Rivas2022;@C40CAPF]. However, these tools generally offer limited support for the systematic evaluation and prioritization of mitigation measures.

Practice-oriented guidance is commonly provided through measure catalogues, planning guides, and collections of best practices [@Kopp2026]. While such resources help municipalities identify potential mitigation options, they are typically available only as static documents. Consequently, users must manually assess individual measures and their interactions, while knowledge on synergies, conflicts, and implementation dependencies remains largely implicit.

Research models and consulting studies can provide detailed analyses of mitigation pathways for specific sectors, such as energy, mobility, or water infrastructure [@Hall2016;@Pfenninger2014]. Although these approaches offer valuable insights, they are often developed for specific projects and do not support integrated decision-making across sectors.

KommMa complements these approaches by integrating structured knowledge on climate mitigation measures and their interdependencies within a single analytical framework. By combining municipality-specific data with scientifically assessed measures and explicitly represented relationships among them, the software enables transparent and reproducible cross-sector analyses. In this way, KommMa supports the evaluation and prioritization of municipal mitigation portfolios while complementing existing planning and modelling approaches.

# Software design
KommMa follows a client-server architecture consisting of a React-based frontend and a Python-based backend. The frontend provides the user interface for entering municipality-specific parameters and exploring assessment results, while the backend implements the data processing, evaluation logic, and prioritization workflows.

To facilitate reproducible deployment and development, the software is containerized using Docker. Separate Dockerfiles are provided for the frontend and backend, and a Docker Compose configuration orchestrates both services during development and deployment. This setup reduces environment-specific dependencies and simplifies installation, testing, and operation across different systems.

## Backend
The backend is implemented in Python and consists of two main components: the calculation and data repository layer and the external data integration layer.

The calculation and data repository layer forms the computational core of KommMa. It reads climate mitigation measure workbooks, evaluates the embedded formulas, and produces normalized and comparable results across all measures for a selected municipality. To ensure responsive performance, workbooks are compiled into memory during application startup and calculation results are cached, allowing repeated evaluations to be returned immediately. This layer also provides the metadata required to generate input forms dynamically in the frontend. Consequently, changes to input parameters defined in the underlying workbooks are automatically reflected in the user interface without requiring modifications to the application code.

The external data integration layer retrieves and maintains publicly available information on municipalities and weather stations from sources such as the German Federal Statistical Office (Statistisches Bundesamt), the Regional Database Germany (Regionaldatenbank Deutschland), the German Weather Service (Deutscher Wetterdienst), and the German municipality directory. To avoid latency caused by external requests during user interactions, relevant datasets are downloaded, validated, processed, and stored locally. This enables fast pre-filling of municipal parameters while maintaining up-to-date reference data. The layer further includes monitoring and notification mechanisms that inform administrators about outdated data sources and errors resulting from changes in external interfaces or datasets.

Communication between the frontend and backend is provided through a REST API implemented with FastAPI. This application layer exposes the endpoints used by the React frontend, validates incoming requests, and delegates processing to the appropriate services, repositories, calculation modules, or external data components. The backend is initialized through `main.py`, which creates the FastAPI application, configures middleware and routing, and initializes the required dependencies.

## Frontend
The frontend is implemented in TypeScript and JavaScript. It is built using React as the frontend framework, Redux for state management, Tailwind CSS for styling, and Jest for testing. A complete list of frontend dependencies is provided in `frontend/webapp/package.json`.

The frontend is organized around four main pages: Home (Startseite), Measures (Maßnahmen), Data Input (Dateneingabe), and Results (Ergebnis). In a typical workflow, users navigate from Home to Data Input and then to Results. The Measures page provides additional information about all available climate mitigation measures but is not required for the standard workflow.

The Data Input page collects the municipal information required for the evaluation process. Input fields and municipality-specific prefill values are loaded dynamically from the backend, while all user-provided information is managed centrally through Redux. Automatically provided values can be modified by users when more accurate or up-to-date information is available. The current input state can be exported and restored in a later session. Since prefilled values may become outdated as underlying public datasets are updated, all values are validated by the backend before being used in calculations.

The Results page presents prioritized mitigation measures through several complementary views. It displays the degree to which recommendations are customized to municipality-specific input data as well as key indicators such as implementation costs, implementation time, and greenhouse gas emission reductions. In addition, relationships between measures are visualized, including synergies, conflicts, and implementation dependencies. Users can mark measures as already implemented or infeasible, which dynamically updates related recommendations. The ranking can be further adapted using filters and a barycentric weighting control. Results can be exported in formats including PDF, DOCX, and CSV.

# Research impact statement
KommMa was developed within a multi-institutional research project at the Karlsruhe Institute of Technology (KIT) to support research on municipal climate mitigation planning. A central outcome of the project is a structured knowledge base covering climate mitigation measures in the sectors of energy, mobility, and water and wastewater management. Measures have been evaluated using a common set of criteria, and their interdependencies have been documented in a reusable form.

This knowledge base forms the foundation of the software and enables analysis of interactions among mitigation measures across sectors. By combining these assessments with municipality-specific parameters, KommMa provides a framework for exploring alternative mitigation portfolios and their expected characteristics, including greenhouse gas emission reductions, implementation costs, implementation timeframes, and selected social indicators.

The software was developed with municipal utilities, climate and energy agencies, and municipal associations through a co-design process [@Howarth2022]. Feedback from these stakeholders informed the software design and evaluation framework. This iterative process aligned the software with municipal climate action planning needs.

As open-source research software, KommMa contributes a reusable framework for representing, evaluating, and prioritizing municipal climate mitigation measures. The software provides a foundation for future research on cross-sector mitigation planning and the further development of municipal climate decision-support approaches.

# AI usage disclosure
Generative AI tools were used during software development and documentation. In the frontend, AI-assisted code generation was primarily used for formatting tasks, particularly when working with Tailwind CSS. During both frontend and backend development, AI tools were also used to generate software test cases, support code refactoring, and improve project documentation.

The project team used AI assistants including GitHub Copilot, Claude, ChatGPT, and Microsoft Copilot for these tasks. In addition, Grammarly and DeepL were used for spell checking, translation, and improving the clarity of English-language documentation and code comments.

AI tools were also used to support the drafting, editing, and language refinement of portions of the accompanying research paper. All AI-generated code, text, documentation, and other project materials were reviewed, adapted where necessary, and validated by the authors before inclusion in the project or manuscript. The authors remain fully responsible for the correctness, functionality, interpretation, and content of the software and documentation.

# Acknowledgements
The authors would like to thank the entire KommMa team at the Karlsruhe Institute of Technology (KIT) for their contributions to the development of the software and the underlying methodological framework. We also thank the members of the project advisory board, municipal utilities, climate and energy agencies, and municipal associations for their valuable feedback throughout the co-design process.

This work was funded by the German Federal Ministry of Research, Technology and Space (BMFTR) through the VIP+ programme (Validation of the Innovation Potential of Scientific Research), grant no. 03VP12091.


# References
The complete BibTeX bibliography is available in [kommMa_Joss.bib](kommMa_Joss.bib).

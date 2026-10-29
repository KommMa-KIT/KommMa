# KommMa – An Interactive Decision-Support Tool for Climate Change Mitigation

## Overview
KommMa is an open-source decision-support tool for municipal climate action planning. The goal is to support municipal to select the best fitting climate change mitigation.
For more information please have a look at [paper.md](paper.md).

## Features
@Micha, hier wäre cool, wenn du vlt dir gedanken machst
Würde auf jeden Fall folgendes einbauen: interdependencies, including synergies, conflicts, and implementation dependencies

## Requirements
### Software
Git
Docker Engine (Linux) or Docker Desktop (Windows/macOS) 
Docker Compose Plugin

### Hardware 
| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 core | 2 cores |
| RAM | 2 GB | 4 GB |
| Storage | 15 GB | 30 GB |

Note: Storage majorly depends on used data (database and pictures)

### Infrastructure [PRODUCTION ONLY]
Server
Domain (currently "kommma.com")
Cloudflare Tunnel Token (matching the Domain)
### Infrastructure [DEVELOPMENT ONLY]
Open ports: 3000 (Frontend), 8000 (Backend), 4000 (Stub)

## Installation
0. Install required software (see [Requirements/Software](#Software)).
1. Clone git repository.
2. Add data, secrets and configure (see [Configuration](#Configuration)).
3. Run "docker compose up -d --build" in "infra/".

## Configuration
### Secrets
- data/
- infra/nginx/login
- infra/nginx/.htpasswd
- infra/.env
- login_data.env

## Usage
@Micha
Hier sind Screenshots aus dem Tool ne gute Idee, die zeigen, wie man es benutzt
vlt sehr gut mit den Features zusammen machbar?

## Project Structure
KommMa has a Python Backend and a Rust Frontend. The tree below shows the important structure of the project:
```bash
KommMa/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt                         # Python dependencies
│   ├── services/                                # systemd services and timers
│   ├── test/                                    # Backend tests
│   └── src/
│       ├── ApplicationLayer/                    # Application logic and API
│       │   ├── api/
│       │   ├── CalculationApi/
│       │   ├── DataApi/
│       │   └── Validation/
│       ├── app_logging/                         # Application logging
│       ├── config.py                            # Backend configuration
│       ├── DatabaseRepositoryLayer/             # Excel-backed data access and calculations
│       │   ├── CalculationRepository/
│       │   │   ├── engine/
│       │   │   │   └── formulaEngine.py
│       │   │   └── preprocessing/
│       │   ├── DataInputRepository/
│       │   ├── ExcelSyncRepository/
│       │   ├── GraphRepository/
│       │   ├── MeasureRepository/
│       │   └── ReferenceCommuneRepository/
│       ├── dependencies/                        # Dependency injection and service wiring
│       ├── EMail_Service.py                     # Automated administrator emails
│       ├── Exceptions/                          # Custom exceptions
│       ├── externalAPI/                         # External data integration
│       │   ├── Checker.py                       # Source freshness checks
│       │   ├── DaemonJob.py                     # Nightly data download and update job
│       │   ├── Downloader.py                    # External data downloads
│       │   ├── HalfyearJob.py                   # Semiannual source update checks
│       │   ├── Parser.py                        # Municipal data lookup, prefilling and validation
│       │   └── Updater.py                       # Local dataset updates
│       └── main.py                              # Backend entry point
├── config/                                      # Configuration files
│   ├── Checker.json                             # Source update checks and last-seen metadata
│   ├── constants_that_change.json               # Last notification dates and dataset reference year
│   ├── DownloadConfig.json                      # External data source settings
│   ├── ExcelSyncConfig.json                     # Automatic Excel synchronization
│   └── Input_fields_id.json                     # Input field identifier mappings
├── data/                                        # Data directory for Excel models, external datasets, and images
├── frontend/
│   ├── Dockerfile
│   ├── stub_backend/                            # Mock backend for frontend testing
│   └── webapp/
│       ├── package.json                         # Dependencies and build scripts
│       ├── public/                              # Static assets
│       └── src/
│           ├── App.tsx
│           ├── components/                      # Reusable UI components
│           │   ├── input/
│           │   │   └── fields/
│           │   ├── measures/
│           │   ├── ReferenceCommuneCard.tsx
│           │   └── results/
│           ├── config.tsx
│           ├── index.tsx
│           ├── layout/                          # Page layouts
│           ├── pages/                           # Application pages
│           ├── routing/                         # Route guards
│           ├── services/                        # API clients and import/export services
│           ├── store/                           # Redux state management
│           ├── types/                           # Type definitions
│           └── utils/                           # Utility functions
└── infra/                                       # Deployment infrastructure
    ├── docker-compose.yml
    └── nginx/                                   # Reverse proxy and optional access control
```
The frontend tests are located in `*.test` directories alongside the corresponding source directories in `frontend/webapp/src/`.



## Further Information
- [Website: www.kommma-im-klimaschutz.de/index.php](https://www.kommma-im-klimaschutz.de/index.php) 
- [JOSS Paper](paper.md)

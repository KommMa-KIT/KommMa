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
| Storage | 10 GB | 30 GB |

Note: Storage majorly depends on used data (database and pictures)

### Infrastructure [PRODUCTION ONLY]
Server
Domain (currently "kommma.com")
Cloudflare Tunnel Token (matching the Domain)
### Infrastructure [DEVELOPMENT ONLY]
Open ports: 3000 (Frontend), 8000 (Backend), 4000 (Stub)

## Installation
0. Make sure that all requirements are met. (see [Requirements](#requirements)).
1. Clone git repository.
2. Add data, secrets and configure (see [Configuration](#configuration)).
3. Install daemons for external API integration (follow the installation guides provided by [README_DAEMON_JOB](backend/services/README_DAEMON_JOB.md), [README_EXCEL_SYNC_DBRL](backend/services/README_EXCEL_SYNC_DBRL.md), [README_HALFYEAR_DAEMON](backend/services/README_HALFYEAR_DAEMON.md)).
4. Run "cd infra && docker compose up -d --build".

## Configuration
1. Add your usage data in "data/".
2. Add "login_data.env" by altering "example.login_data.env" and configure the required email and database login credentials inside the file.
3. Add "infra/.env" by altering "infra/example.env" and configure like described in the file.
   There you can choose between development and production mode!
   If you use production mode, make sure to add your Cloudflare tunnel token!
### PRODUCTION ONLY
4. Replace all occurences of "kommma.com" in "infra/nginx/nginx.conf" and "frontend/webapp/src/config.tsx" with your own domain.
5. Replace all legal information (especially [LegalDisclosurePage](frontend/webapp/src/pages/LegalDisclosurePage.tsx), [PrivacyPolicyPage](frontend/webapp/src/pages/PrivacyPolicyPage.tsx), [Footer](frontend/webapp/src/layout/Footer.tsx)) with your own.
6. [optional] Add login credentials:
   a) Run "sudo apt install apache2-utils && htpasswd -c infra/nginx/.htpasswd <username>". You will be asked to type in a password.
   b) [optional] Add a file (e.g. infra/nginx/login) with your credentials (potential security risk!).
   c) Uncomment both lines in "infra/nginx/auth.conf".

### Secrets
- data/
- login_data.env
- infra/.env
- infra/nginx/.htpasswd

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

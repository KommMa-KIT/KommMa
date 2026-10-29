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
data/
infra/nginx/login
infra/nginx/.htpasswd
infra/.env
login_data.env

## Usage
Hier sind Screenshots aus dem Tool ne gute Idee, die zeigen, wie man es benutzt
@Micha; vlt sehr gut mit den Features zusammen machbar?

## Project Structure
@Jonas

## Further Information
- [Website: www.kommma-im-klimaschutz.de/index.php](https://www.kommma-im-klimaschutz.de/index.php) 
- [JOSS Paper](paper.md)

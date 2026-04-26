# Deploying `excel-sync.service` (systemd)

> **Important:** The files in this repository folder are **not** used by the server automatically.  
> To apply changes, you must copy `excel-sync.service` to `/etc/systemd/system/`.

### FYI
`excel-sync.service` is a **persistent background service** (`Type=simple`), unlike the timer-based jobs.  
It watches `DataGeneralMastertable.xlsx` for filesystem changes and propagates updated `Wert` values
into every dependent calculation sheet (`MeasureCalculationSheets/*.xlsx`, Sheet index 1 only).  
All paths and column names are driven by `/app/config/ExcelSyncConfig.json` — no hardcoding.

The watcher runs **on-demand**: it uses Linux inotify (via watchdog) so it only wakes up when the
central file is written on disk. A 3-second debounce collapses rapid multi-write saves into a
single sync run. CPU usage between events is effectively zero.

## Prerequisites
- You are logged into the server
- You are in the directory that contains `excel-sync.service` (e.g. `services/`)
- You have `sudo` permissions

---

## Install / Update changes

### 1) Stop and remove old unit (if updating)
```bash
sudo systemctl disable --now excel-sync.service

sudo rm -f /etc/systemd/system/excel-sync.service
```

### 2) Copy the new unit
```bash
sudo cp excel-sync.service /etc/systemd/system/
```

### 3) Reload systemd to pick up changes
```bash
sudo systemctl daemon-reload
```

### 4) Enable and start the service
```bash
sudo systemctl enable --now excel-sync.service
```

---

## Verify everything is working

### Check the service status
```bash
sudo systemctl status excel-sync.service
```

### Trigger a manual sync (stop + start forces an immediate initial sync on startup)
```bash
sudo systemctl restart excel-sync.service
```

### Start manually to test without enabling on boot
```bash
sudo systemctl start excel-sync.service
```

---

## Logs

### Live log stream
```bash
sudo journalctl -u excel-sync.service -f
```

### Last 200 lines
```bash
sudo journalctl -u excel-sync.service -n 200 --no-pager
```

---

## Troubleshooting

### Changes don't apply
Make sure you ran:
```bash
sudo systemctl daemon-reload
```
Then restart the service:
```bash
sudo systemctl restart excel-sync.service
```

### Service fails to start (Docker not running)
The service has `ExecCondition` guarding against this. Check Docker:
```bash
sudo systemctl status docker.service
```

### Permission denied on a dependent file
A dependent `.xlsx` file may be open in Excel (lock file `~$filename.xlsx` present).
The error is logged but the remaining files are still synced.
The affected file will be updated on the next sync cycle once it is closed.

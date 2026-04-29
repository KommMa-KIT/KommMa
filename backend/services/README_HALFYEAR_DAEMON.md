# Deploying `half_year.timer` + `checker.service` (systemd)

> **Important:** The files in this repository folder are **not** used by the server automatically.  
> To apply changes, you must copy the unit files to `/etc/systemd/system/` and reload systemd. See the information below or the `README_NIGHT_DAEMON.md`.

## What this “Checker” does

The Checker is a maintenance job that runs **half-yearly** and checks whether the external sources used by the tool
are still reachable and whether referenced values/files need to be updated. After the run, the admin receives an
email with the results, including which values must be renewed.

`checker.service` is the systemd unit that starts the Python halfyear job (e.g. `HalfyearJob.py`).  
If you want to change what actually happens on a run, you change the Python code, not the timer.

## Schedule

This deployment uses systemd calendar events in **server-local time**:

- **Apr 1st, 01:00**
- **Oct 1st, 01:00**


## Prerequisites
- You are logged into the server
- You are in the directory that contains `half_year.timer`, and `checker.service`
- You have `sudo` permissions

---

## Install / Update changes

### 1) Disable timers and remove old units
```bash
sudo systemctl disable --now half_year.timer
sudo systemctl stop checker.service

sudo rm -f /etc/systemd/system/half_year.timer \
           /etc/systemd/system/checker.service \
           /etc/systemd/system/timers.target.wants/half_year.timer
```
### 2) Install new timer
```bash
sudo cp half_year.timer /etc/systemd/system/
sudo cp checker.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now half_year.timer
```

## Verify everything is working
### Check the timer schedule
```bash
sudo systemctl list-timers | grep half_year
```

### Check the service status
```bash
sudo systemctl status checker.service
```

### Check the timer status
```bash
sudo systemctl status half_year.timer
```

### Start the dameon manually to check if it works
```bash
sudo systemctl start checker.service
```

## Logs
### Service Logs
```bash
sudo journalctl -u checker.service -n 200 --no-pager
```
## Timer logs / trigger history
```bash
sudo journalctl -u half_year.timer -n 200 --no-pager
```


# Author
Jonas Dorner
Github: @OilersLD
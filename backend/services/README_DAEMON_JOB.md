# Deploying `night.timer` + `daemon.service` (systemd)

> **Important:** The files in this repository folder are **not** used by the server automatically.  
> To apply changes, you must copy `night.timer` and `daemon.service` to `/etc/systemd/system/`.
### FYI
The time in `daemon.service` is set on 02, due to the time shift, to achieve downloading at 03am.
And the `daemon.service` starts the `/app/backend/src/externalAPI/DaemonJob.py`. So if you want to change the behavior of the file. Change `DaemonJob.py`.

## Prerequisites
- You are logged into the server
- You are in the directory that contains `night.timer` and `daemon.service` (e.g. `services/`) (if you want to install or updated changes)
- You have `sudo` permissions

---

## Install / Update changes

### 1) Disable the timer and remove old units
```bash
sudo systemctl disable --now night.timer

sudo rm -f /etc/systemd/system/night.timer \
           /etc/systemd/system/daemon.service \
           /etc/systemd/system/timers.target.wants/night.timer
```
### 2) Copy the new units
```bash
sudo cp night.timer /etc/systemd/system/
sudo cp daemon.service /etc/systemd/system/
```

### 3) Reload systemd to pick up changes
```bash
sudo systemctl daemon-reload
```

### 4) Enable and start the timer
```bash
sudo systemctl enable --now night.timer
```

## Verify everything is working
### Check the timer schedule
```bash
sudo systemctl list-timers | grep night
```

### Check the service status
```bash
sudo systemctl status daemon.service
```

### Check the timer status
```bash
sudo systemctl status night.timer
```

### Start the dameon manually to check if it works
```bash
sudo systemctl start daemon.service
```

## Logs
### Service Logs
```bash
sudo journalctl -u daemon.service -n 200 --no-pager
```
## Timer logs / trigger history
```bash
sudo journalctl -u night.timer -n 200 --no-pager
```

## Troubleshooting
### Changes dont apply
Make sure you ran:
```bash
sudo systemctl daemon-reload
```

Then restart the timer:
```bash
sudo systemctl restart night.timer
```

### Timer triggers but nothing happens
Check the server time:
```bash
timedatectl
```
Show next runs:
```bash
sudo systemctl list-timers | grep night
```

### Helpful Commands
If you want to stop the daemon, cause you just started it for testing purpose use:
```bash
sudo systemctl stop daemon.service
```

## Quick reset
```bash
sudo systemctl disable --now night.timer
sudo systemctl stop daemon.service

sudo rm -f /etc/systemd/system/night.timer \
           /etc/systemd/system/daemon.service \
           /etc/systemd/system/timers.target.wants/night.timer

sudo cp night.timer /etc/systemd/system/
sudo cp daemon.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now night.timer
```

# Author
Jonas Dorner
Github: @OilersLD
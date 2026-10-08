# Playwright Job Scraping

An evolution on my former [job scraper](https://github.com/mason-e/job-scraping) that used Selenium. WIP

## Setup Steps

- Run `npm install`, `npx playwright install-deps` and `npx playwright install` to initialize the repo after cloning.

### Windows Specific

- Needed to execute `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in order to be able to run npm

### Environment Variables

Scrapers with authentication should use environment variables to keep credentials out of code. Right now that's the LinkedIn script, and the names of the environment variables themselves are hardcoded into the script. In the future, these may be separated into a config file.

## Display Results

After running the scripts, start the local results server:

`npm start`

Then open http://localhost:3000. It has a page for viewing scraped results and a page for viewing submitted applications. The search blacklist and applications can be updated from these pages.

## Raspberry Pi Configuration

I configured this to run on a Raspberry Pi so that it can scrape on a schedule and I can view the results from a browser anywhere in my internal network. The main things to configure are a process to run the results server and a cron job for the scraping. 

### Server Process

A service can be created at `/etc/systemd/system/job-dashboard.service`:

```
[Unit]
Description=Job dashboard
After=network.target

[Service]
Type=simple
User=USER
WorkingDirectory=/path/to/playwright-scraping
Environment=PORT=3000
ExecStart=/usr/bin/node /path/to/playwright-scraping/pages/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Replace `USER` with your Pi's username and `/path/to` to whatever working directory you chose to clone the repo to. This also assumes your node is at `/usr/bin/node`; check with `command -v node`.

Enable and start by running:

```
sudo systemctl daemon-reload
sudo systemctl enable --now job-dashboard
```

Check status with `sudo systemctl status job-dashboard` or logs with `journalctl -u job-dashboard -f`.

### Cron Job

I set up a cron job with `crontab -e`. Like with the server process this assumes the node path, and `/path/to` is wherever you have it clone.

```
PATH=/usr/bin/node:/usr/local/bin:/usr/bin:/bin
SCRAPER=/path/to/playwright-scraping
0 17 * * 1-5 /bin/bash -c '. "$HOME/.bashrc" && cd "$SCRAPER" && npm run scrape' >> "$SCRAPER/logs/scraper-cron.log" 2>&1
```

It passes the environment variables that I have set in my `.bahsrc` to the shell to run the scraper, and logs the cron run to the gitignored logs folder. I set it to run M-F at 5 PM, but of course that can be whatever you want.

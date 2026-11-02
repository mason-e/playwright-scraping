# Playwright Job Scraping

An evolution on my former [job scraper](https://github.com/mason-e/job-scraping) that used Selenium. This is actually an all-in-one scraping and job application tracker. It runs on Playwright to scrape for jobs and displays the data back on a simple local Node server.

The objective is to make the job searching process smoother, so aside from collecting results, it also has the following features:

- User configurable blacklists
- Result de-duping
- Highlighting recently applied companies

## Scraping Setup Steps

- [Node](https://nodejs.org/en) and npm are pre-requesites.
- Run `npm install`, `npx playwright install-deps` and `npx playwright install` to initialize the repo after cloning.

### Windows Specific

- Needed to execute `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in order to be able to run npm

## Scraper Execution

### Search URL

The search conditions are currently hardcoded for my own preferred usage - "software engineer" matches for the past day in the Denver area. These will of course work out of the box, but change them to your preferred conditions. There is no current example of multiple searches on the same site, but duplicating the test for a different URL should work.

### Blacklist Configuration

The blacklist is optional, but something I designed the scraper around so that I could take one wide search and filter down rather than do multiple narrow searches. It can filter out three main details on a job listing so they aren't saved to the final result: location, job title and company. Many search sites don't do a great job of showing what you actually want and this helps mitigate that.

Examples of the blacklist (and reasons) formats are in [docs](./docs/). Create a `data` folder in the repo root (gitignored as it is user-specific) to drop `blacklist.json` and `blacklist-reasons.json` files in with the format matching the examples. Alternatively, in the results view, each entry has an Add blacklist button that opens a modal to add words/phrases from the given result, but the reasons file still has to be manually edited for now. Only companies are intended to be given a reason, as the other two should be more self-explanatory.

### Environment Variables

Scrapers with authentication should use environment variables to keep credentials out of code. Right now that's the LinkedIn script, and the names of the environment variables themselves are hardcoded into the script. In the future, these may be separated into a config file.

Detailed instructions on setting environment variables won't be described here since there are many different ways to do it depending on OS, shell, desired scope, etc.

### Execution

The scraper scripts are run like any Playwright test, but for simplicity's sake, here are some recommended commands to choose from:

- `npx playwright test --ui` - Open UI to select script(s) to run with visuals
- `npx playwright test scripts/{scriptname}.spec.js` - Run single script headlessly
- `npm run scrape` - Runs a `package.json`-defined command to run each script headlessly in sequence (`--workers=1`) with terminal (`line`) reporting.

Running in parallel is not recommended since the scripts write to the same results file.

### Troubleshooting

Aside from doing standard Playwright troubleshooting practice (reports, observing in headed mode), the scraper scripts are designed to write logs to a gitignored `logs` folder in the repo root. One log file is written and appended continuously with general details from each run (success or failure), but each failed run should get its own file with trace details varying on whatever the specific error is.

## Display Results

After running the scripts, start the local results server:

`npm start`

Then open http://localhost:3000. It has a page for viewing scraped results and a page for tracking submitted applications. Note that the applications are for personal records - these of course do NOT apply to the company, which has to be done on their site.

Blacklist entries can be made from here. Click the "Add" button for a row and it will populate a modal with the three main fields from the listing. Any of the three can be edited before submitting independently.

The "Add" application button for a result row works in a similar way - pre-populated, but editable. It has some additional tracking fields as well. An application record can also be added from scratch from the Applications page.

The application records are searchable and filterable. The search results page also has a feature where it uses these records to highlight recently-applied companies.

## Raspberry Pi Configuration

I configured this to run on a Raspberry Pi so that it can scrape on a schedule and I can view the results from a browser anywhere in my internal network. The main things to configure are a process to run the results server and a cron job for the scraping. 

This concept could be applied to other machines as well (and perhaps near verbatim for others that are Linux), although not all Raspberry Pi models support Playwright. I used a 4 and it doesn't work on 3.

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

I set up a cron job with `crontab -e`. Like with the server process this assumes the node path, and `/path/to` is wherever you have it cloned:

```
PATH=/usr/bin/node:/usr/local/bin:/usr/bin:/bin
SCRAPER=/path/to/playwright-scraping
0 17 * * 1-5 /bin/bash -c '. "$HOME/.bashrc" && cd "$SCRAPER" && npm run scrape'
```

It passes the environment variables that I have set in my `.bahsrc` to the shell to run the scraper, and logs the cron run to the gitignored logs folder. I set it to run M-F at 5 PM, but of course that can be whatever you want.

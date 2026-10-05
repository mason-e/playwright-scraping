# Playwright Job Scraping

An evolution on my former [job scraper](https://github.com/mason-e/job-scraping) that used Selenium. WIP

## Setup Steps

- Run `npm install`, `npx playwright install-deps` and `npx playwright install` to initialize the repo after cloning.

### Windows Specific

- Needed to execute `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in order to be able to run npm

## Display Results

After running the scripts, start the local results server:

`npm start`

Then open http://localhost:3000 for search results or http://localhost:3000/apps.html for submitted applications. The applications page reads `data/jobs-applied.json`; the era files are not loaded.
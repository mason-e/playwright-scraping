# Playwright Job Scraping

An evolution on my former [job scraper](https://github.com/mason-e/job-scraping) that used Selenium. WIP

## Setup Steps

- Run `npm install`, `npx playwright install-deps` and `npx playwright install` to initialize the repo after cloning.

### Windows Specific

- Needed to execute `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in order to be able to run npm

## Display Results

After running the scripts, start the local results server:

`npm start`

Then open http://localhost:3000. It has a page for viewing scraped results and a page for viewing submitted applications. The search blacklist and applications can be updated from these pages.
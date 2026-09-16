# Playwright Job Scraping

An evolution on my former [job scraper](https://github.com/mason-e/job-scraping) that used Selenium. WIP

## Setup Steps

- Run `npx playwright install-deps` and `npx playwright install` to initialize the repo after cloning.

### Windows Specific

- Needed to execute `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in order to be able to run npm

## Display Results

After running the scripts, run the web page as a local server to get a formatted readout. I used Python for this. Python install/setup is out of scope for this README since there are plenty of possible variations.

`{python} -m http.server 8000` where {python} = `python3`, `python`, or `py`. Again, config can vary.

Then open http://localhost:8000/results.html in a browser.
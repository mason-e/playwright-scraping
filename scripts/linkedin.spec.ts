import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Page, test } from '@playwright/test';
import { BlacklistMap, isBlacklisted, loadBlacklist } from '../helpers/blacklist';
import { JobSearchRecord } from '../helpers/record-types';

const outputPath = path.resolve('data/search-results.json');

async function authenticateLinkedIn(page: Page) {
  const username = process.env.LinkedInUser;
  const password = process.env.LinkedInPassword;

  if (!username || !password) {
    throw new Error('LinkedIn credentials are not set. Expected LinkedInUser and LinkedInPassword environment variables.');
  }

  await page.goto('https://www.linkedin.com/login/');
  await page.getByRole('textbox', { name: 'Email or phone' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: /^Me$/i }).waitFor({ state: 'visible', timeout: 5_000 });
}

async function pageThroughEnd(page: Page, records: JobSearchRecord[], blacklist: BlacklistMap) {
    const jobCards = page.locator('.display-flex.job-card-container');
    const resultsContainer = page.locator('#jobs-search-results-footer');

    await jobCards.first().waitFor({ state: 'visible', timeout: 5_000 });
    await resultsContainer.waitFor({ state: 'visible', timeout: 5_000 });

    let loadedCount = await jobCards.count();
    let i = 0;
    while (i < loadedCount) {
      loadedCount = await jobCards.count();
      const nextIndex = Math.min(i + 1, loadedCount - 1);
      const card = jobCards.nth(nextIndex);

      await card.evaluate((element) => {
        element.scrollIntoView({ block: 'center', inline: 'nearest' });
      });
      await page.waitForTimeout(200);
      i++;
    }

    await collectJobRecords(page, records, blacklist);
    const nextPage = page.getByRole('button', { name: 'View next page' }).first();

    if (await nextPage.count() === 0) {
        return;
    }

    await nextPage.click();
    await pageThroughEnd(page, records, blacklist);
}

async function collectJobRecords(page: Page, records: JobSearchRecord[], blacklist: BlacklistMap) {
    const rows = await page.locator('.display-flex.job-card-container').all();

    for (const row of rows) {
        const titleLink = row.locator('a.job-card-container__link').first();
        const title = (await titleLink.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
        const company = (await row.locator('.artdeco-entity-lockup__subtitle span[dir="ltr"]').first().textContent())?.replace(/\s+/g, ' ').trim() ?? '';
        const location = (await row.locator('.artdeco-entity-lockup__caption li span[dir="ltr"]').first().textContent())?.replace(/\s+/g, ' ').trim() ?? '';
        const url = await titleLink.getAttribute('href');

        const record = {
            title,
            company,
            location,
            url: url ? new URL(url, 'https://www.linkedin.com').toString() : undefined,
        };

        if (!isBlacklisted(record, blacklist)) {
            records.push(record);
        }
    }
}

function recordKey(record: JobSearchRecord) {
    return `${record.title}|${record.company}`.toLowerCase();
}

async function readSavedRecords() {
    try {
        const contents = await readFile(outputPath, 'utf8');
        return JSON.parse(contents) as JobSearchRecord[];
    } catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

async function saveRecords(records: JobSearchRecord[]) {
    const savedRecords = await readSavedRecords();
    const existingKeys = new Set(savedRecords.map(recordKey));
    const newRecords = records.filter((record) => {
        const key = recordKey(record);
        console.log(`Checking record: ${key}`);
        if (existingKeys.has(key)) {
            return false;
        }

        existingKeys.add(key);
        return true;
    });
    const recordsToSave = [...savedRecords, ...newRecords];

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(recordsToSave, null, 2)}\n`, 'utf8');
}

test("scrape linkedin for last day", async ({ page }) => {
  const blacklist = await loadBlacklist();
  await authenticateLinkedIn(page);
  await page.goto('https://www.linkedin.com/jobs/search/?f_TPR=r86400&geoId=90000034&keywords=Software%20Engineer&location=Denver%20Metropolitan%20Area');
  const records: JobSearchRecord[] = [];
  await pageThroughEnd(page, records, blacklist);
  await saveRecords(records);
});
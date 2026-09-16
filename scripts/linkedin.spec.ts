import { Page, test } from '@playwright/test';
import { loadBlacklist } from '../helpers/blacklist';
import { JobSearchRecord } from '../helpers/record-types';
import { JobRecordSelectors, LoadAllResults, pageThroughEnd, saveRecords } from '../helpers/search-results';

const linkedinSelectors: JobRecordSelectors = {
  rows: '.display-flex.job-card-container',
  title: (row) => row.locator('a.job-card-container__link'),
  company: (row) => row.locator('.artdeco-entity-lockup__subtitle span[dir="ltr"]'),
  location: (row) => row.locator('.artdeco-entity-lockup__caption li span[dir="ltr"]'),
  url: (row) => row.locator('a.job-card-container__link'),
  baseUrl: 'https://www.linkedin.com',
  nextPage: (page) => page.getByRole('button', { name: 'View next page' }).first(),
};

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

/**
 * LinkedIn uses lazy loading for job cards, so this scrolls through the cards to ensure the next
 * set of cards loads until we get to the end of the page.
 */
const loadAllLinkedInResults: LoadAllResults = async (page) => {
  const jobCards = page.locator('.display-flex.job-card-container');
  const resultsContainer = page.locator('#jobs-search-results-footer');

    await jobCards.first().waitFor({ state: 'visible', timeout: 5_000 });
    await resultsContainer.waitFor({ state: 'visible', timeout: 5_000 });

    let loadedCount = await jobCards.count();
    for (let i = 0; i < loadedCount; i++) {
      loadedCount = await jobCards.count();
      const nextIndex = Math.min(i + 1, loadedCount - 1);
      const card = jobCards.nth(nextIndex);

      await card.evaluate((element) => {
        element.scrollIntoView({ block: 'center', inline: 'nearest' });
      });
      await page.waitForTimeout(200);
    }
};

test("scrape linkedin for last day", async ({ page }) => {
  const blacklist = await loadBlacklist();
  await authenticateLinkedIn(page);
  await page.goto('https://www.linkedin.com/jobs/search/?f_TPR=r86400&geoId=90000034&keywords=Software%20Engineer&location=Denver%20Metropolitan%20Area');
  const records: JobSearchRecord[] = [];
  await pageThroughEnd(page, records, blacklist, linkedinSelectors, loadAllLinkedInResults);
  await saveRecords(records);
});
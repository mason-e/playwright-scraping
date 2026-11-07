import { Page, test } from '@playwright/test';
import { loadBlacklist } from '../helpers/blacklist';
import { logTestResult } from '../helpers/logging';
import { JobSearchRecord } from '../helpers/record-types';
import { JobRecordLocators, LoadAllResults, pageThroughEnd, saveRecords } from '../helpers/search-results';

const linkedInLocators: JobRecordLocators = {
  rows: 'div[role="button"][componentkey^="job-card-component-ref-"]',
  title: (row) => row.locator('p[class*="gm6"][class*="ljc"] > span[aria-hidden="true"]'),
  company: (row) => row.locator('p[class*="goj"][class*="ljc"]'),
  location: (row) => row.locator('p[class*="lca"][class*="gpp"][class*="ljc"]'),
  resolveUrl: async (row) => {
    const componentKey = await row.getAttribute('componentkey');
    const componentId = componentKey?.replace(/^job-card-component-ref-/, '').trim();
    return componentId ? `https://www.linkedin.com/jobs/view/${componentId}/` : undefined;
  },
  baseUrl: 'https://www.linkedin.com',
  nextPage: (page) => page.getByRole('button', { name: 'Next', exact: true }).first(),
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
  const jobCards = page.locator('div[role="button"][componentkey^="job-card-component-ref-"]');

  await jobCards.first().waitFor({ state: 'visible', timeout: 5_000 });

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

const records: JobSearchRecord[] = [];
const counts: { total: number; filtered: number; unique: number } = { total: 0, filtered: 0, unique: 0 };

test.afterEach(async ({ }, testInfo) => logTestResult(testInfo, counts));

test("scrape linkedin for last day", async ({ page }) => {
  const blacklist = await loadBlacklist();
  await authenticateLinkedIn(page);
  await page.goto('https://www.linkedin.com/jobs/search/?f_TPR=r86400&geoId=90000034&keywords=Software%20Engineer&location=Denver%20Metropolitan%20Area');
  let scrapeError: unknown;

  try {
    counts.total = await pageThroughEnd(page, records, blacklist, linkedInLocators, loadAllLinkedInResults);
  }
  catch (error) {
    scrapeError = error;
  }

  counts.filtered = records.length;

  if (counts.filtered > 0) {
    counts.unique = await saveRecords(records);
  }

  if (scrapeError) {
    throw scrapeError;
  }
});

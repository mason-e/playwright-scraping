import { test } from '@playwright/test';
import { loadBlacklist } from '../helpers/blacklist';
import { logTestResult } from '../helpers/logging';
import { JobSearchRecord } from '../helpers/record-types';
import { JobRecordLocators, pageThroughEnd, saveRecords } from '../helpers/search-results';

const builtInLocators: JobRecordLocators = {
  rows: '//div[@id="main"][@class="row"]',
  title: (row) => row.getByTestId('job-card-title'),
  company: (row) => row.getByTestId('company-title'),
  location: (row) => row.locator('i.fa-location-dot').locator('xpath=../following-sibling::div/span'),
  url: (row) => row.getByTestId('job-card-title'),
  baseUrl: 'https://www.builtincolorado.com',
  nextPage: (page) => page.getByRole('link', { name: 'Go to Next Page' }),
};

const records: JobSearchRecord[] = [];
const counts: { total: number; filtered: number; unique: number } = { total: 0, filtered: 0, unique: 0 };

test.afterEach(async ({ }, testInfo) => logTestResult(testInfo, counts));

test("scrape builtin for last day", async ({ page }) => {
  const blacklist = await loadBlacklist();
  await page.goto('https://www.builtincolorado.com/jobs/remote/hybrid/office/dev-engineering?search=software+engineer&daysSinceUpdated=1&state=Colorado&country=USA&allLocations=true');
  let scrapeError: unknown;

  try {
    counts.total = await pageThroughEnd(page, records, blacklist, builtInLocators);
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

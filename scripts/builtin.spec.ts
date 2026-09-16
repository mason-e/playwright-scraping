import { test } from '@playwright/test';
import { loadBlacklist } from '../helpers/blacklist';
import { JobSearchRecord } from '../helpers/record-types';
import { JobRecordSelectors, pageThroughEnd, saveRecords } from '../helpers/search-results';

const builtinSelectors: JobRecordSelectors = {
    rows: '//div[@id="main"][@class="row"]',
    title: (row) => row.getByTestId('job-card-title'),
    company: (row) => row.getByTestId('company-title'),
    location: (row) => row.locator('i.fa-location-dot').locator('xpath=../following-sibling::div/span'),
    url: (row) => row.getByTestId('job-card-title'),
    baseUrl: 'https://www.builtincolorado.com',
    nextPage: (page) => page.getByRole('link', { name: 'Go to Next Page' }),
};

test("scrape builtin for last day", async ({ page }) => {
    const blacklist = await loadBlacklist();
    await page.goto('https://www.builtincolorado.com/jobs/remote/hybrid/office/dev-engineering?search=software+engineer&daysSinceUpdated=1&state=Colorado&country=USA&allLocations=true');
    const records: JobSearchRecord[] = [];
    await pageThroughEnd(page, records, blacklist, builtinSelectors);
    await saveRecords(records);
});

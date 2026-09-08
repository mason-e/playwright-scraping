import { Page, test } from '@playwright/test';

async function pageThroughEnd(page: Page) {
    await printJobInfo(page);
    const nextPage = await page.getByRole('link', { name: 'Go to Next Page' });

    if (await nextPage.count() === 0) {
        return;
    }

    await nextPage.click();
    await pageThroughEnd(page);
}

async function printJobInfo(page: Page) {
    const rows = await page.locator('//div[@id="main"][@class="row"]').all();
    for (const row of rows) {
        const title = await row.getByTestId('job-card-title').textContent();
        const company = await row.getByTestId('company-title').textContent();
        const location = await row.locator('i.fa-location-dot').locator('xpath=../following-sibling::div/span').textContent();
        console.log(`Job title: ${title}`);
        console.log(`Company: ${company}`);
        console.log(`Location: ${location}`);
    }
}

test("scrape builtin for last day", async ({ page }) => {
    await page.goto('https://www.builtincolorado.com/jobs/remote/hybrid/office/dev-engineering?search=software+engineer&daysSinceUpdated=7&state=Colorado&country=USA&allLocations=true');
    await pageThroughEnd(page);
});

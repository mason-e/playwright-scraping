import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Page, test } from '@playwright/test';
import { JobSearchRecord } from '../helpers/record-types';

const outputPath = path.resolve('data/builtin-jobs.json');
const blacklist = {
    title: ["Pencil Pusher"] as string[],
    company: ["Megacorp"] as string[],
    location: ["Metropolis"] as string[],
};

async function pageThroughEnd(page: Page, records: JobSearchRecord[]) {
    await collectJobRecords(page, records);
    const nextPage = await page.getByRole('link', { name: 'Go to Next Page' });

    if (await nextPage.count() === 0) {
        return;
    }

    await nextPage.click();
    await pageThroughEnd(page, records);
}

async function collectJobRecords(page: Page, records: JobSearchRecord[]) {
    const rows = await page.locator('//div[@id="main"][@class="row"]').all();
    for (const row of rows) {
        const title = await row.getByTestId('job-card-title').textContent();
        const company = await row.getByTestId('company-title').textContent();
        const location = await row.locator('i.fa-location-dot').locator('xpath=../following-sibling::div/span').textContent();
        const url = await row.getByTestId('job-card-title').getAttribute('href');
        const record = {
            title: title?.trim() ?? '',
            company: company?.trim() ?? '',
            location: location?.trim() ?? '',
            url: url ?? undefined,
        };

        if (!isBlacklisted(record)) {
            records.push(record);
        }
    }
}

function isBlacklisted(record: JobSearchRecord) {
    return Object.entries(blacklist).some(([field, values]) =>
        values.some((value) => record[field as keyof typeof blacklist].toLowerCase().includes(value.toLowerCase()))
    );
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

test("scrape builtin for last day", async ({ page }) => {
    await page.goto('https://www.builtincolorado.com/jobs/remote/hybrid/office/dev-engineering?search=software+engineer&daysSinceUpdated=7&state=Colorado&country=USA&allLocations=true');
    const records: JobSearchRecord[] = [];
    await pageThroughEnd(page, records);
    await saveRecords(records);
});

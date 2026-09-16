import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Locator, Page } from '@playwright/test';
import { BlacklistMap, isBlacklisted } from './blacklist';
import { JobSearchRecord } from './record-types';

const outputPath = path.resolve('data/search-results.json');

export type JobRecordSelectors = {
    rows: string;
    title: (row: Locator) => Locator;
    company: (row: Locator) => Locator;
    location: (row: Locator) => Locator;
    url: (row: Locator) => Locator;
    baseUrl: string;
    nextPage: (page: Page) => Locator;
};

export type LoadAllResults = (page: Page) => Promise<void>;

export async function collectJobRecords(
    page: Page,
    records: JobSearchRecord[],
    blacklist: BlacklistMap,
    selectors: JobRecordSelectors,
) {
    const rows = await page.locator(selectors.rows).all();

    for (const row of rows) {
        const title = await selectors.title(row).first().textContent();
        const company = await selectors.company(row).first().textContent();
        const location = await selectors.location(row).first().textContent();
        const url = await selectors.url(row).first().getAttribute('href');

        const record = {
            title: title?.replace(/\s+/g, ' ').trim() ?? '',
            company: company?.replace(/\s+/g, ' ').trim() ?? '',
            location: location?.replace(/\s+/g, ' ').trim() ?? '',
            isRead: false,
            url: url ? new URL(url, selectors.baseUrl).toString() : undefined,
        };

        if (!isBlacklisted(record, blacklist)) {
            records.push(record);
        }
    }
}

export async function pageThroughEnd(
    page: Page,
    records: JobSearchRecord[],
    blacklist: BlacklistMap,
    selectors: JobRecordSelectors,
    loadAllResults?: LoadAllResults,
) {
    await loadAllResults?.(page);
    await collectJobRecords(page, records, blacklist, selectors);
    const nextPage = selectors.nextPage(page);

    if (await nextPage.count() === 0) {
        return;
    }

    await nextPage.click();
    await pageThroughEnd(page, records, blacklist, selectors, loadAllResults);
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

export async function saveRecords(records: JobSearchRecord[]) {
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

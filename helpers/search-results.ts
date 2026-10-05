import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { Locator, Page } from '@playwright/test';
import { BlacklistMap, isBlacklisted } from './blacklist';
import { LocatorContentError, LocatorNotFoundError } from './logging';
import { JobSearchRecord } from './record-types';

const outputPath = path.resolve('data/search-results.json');

export type JobRecordLocators = {
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
    locators: JobRecordLocators,
) {
    const rows = await page.locator(locators.rows).all();

    for (const row of rows) {
        const title = await locators.title(row).first().textContent();
        const company = await locators.company(row).first().textContent();
        const location = await locators.location(row).first().textContent();
        const url = await locators.url(row).first().getAttribute('href');

        const record = {
            id: randomUUID(),
            title: title?.replace(/\s+/g, ' ').trim() ?? 'UNKNOWN',
            company: company?.replace(/\s+/g, ' ').trim() ?? 'UNKNOWN',
            location: location?.replace(/\s+/g, ' ').trim() ?? 'UNKNOWN',
            isRead: false,
            url: url ? new URL(url, locators.baseUrl).toString() : undefined,
        };

        if (!isBlacklisted(record, blacklist)) {
            records.push(record);
        }
    }

    return rows.length;
}

export async function pageThroughEnd(
    page: Page,
    records: JobSearchRecord[],
    blacklist: BlacklistMap,
    locators: JobRecordLocators,
    loadAllResults?: LoadAllResults,
) {
    const nextPage = locators.nextPage(page);
    let count = 0;
    const collectAndClickNext = async () => {
        await loadAllResults?.(page);
        count += await collectJobRecords(page, records, blacklist, locators);
        await verifyRecords(records);
        if (await nextPage.count() === 0) {
            return;
        }

        await nextPage.click();
        await collectAndClickNext();
    };
    
    await verifyLocators(page, locators);
    await collectAndClickNext();
    return count;
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
        if (existingKeys.has(key)) {
            return false;
        }

        existingKeys.add(key);
        return true;
    });
    const recordsToSave = [...savedRecords, ...newRecords];

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(recordsToSave, null, 2)}\n`, 'utf8');
    return newRecords.length;
}

export async function verifyLocators(page: Page, locators: JobRecordLocators) {
    const rowLocator = page.locator(locators.rows);
    if (await rowLocator.count() === 0) {
        throw new LocatorNotFoundError('Row locator matched no elements. Row child locators are not verified.');
    }

    const row = rowLocator.first();
    const locatorMap = [
        ['Title', locators.title(row)],
        ['Company', locators.company(row)],
        ['Location', locators.location(row)],
        ['URL', locators.url(row)],
    ] as const;
    const missing: string[] = [];

    for (const [name, locator] of locatorMap) {
        if (await locator.count() === 0) {
            missing.push(name);
        }
    }

    if (missing.length > 0) {
        throw new LocatorNotFoundError(`Missing locator(s): ${missing.join(', ')}`);
    }
}

export async function verifyRecords(records: JobSearchRecord[]) {
    const unknownFields: string[] = [];
    if (records.every((record) => record.title === 'UNKNOWN')) {
        unknownFields.push('Title');
    }
    if (records.every((record) => record.company === 'UNKNOWN')) {
        unknownFields.push('Company');
    }
    if (records.every((record) => record.location === 'UNKNOWN')) {
        unknownFields.push('Location');
    }
    if (records.every((record) => !record.url)) {
        unknownFields.push('URL');
    }
    if (unknownFields.length > 0) {
        throw new LocatorContentError(`Every ${unknownFields.join(', ')} failed to return a value.`);
    }
}

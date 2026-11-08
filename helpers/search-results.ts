import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { DateTime } from 'luxon';
import { Locator, Page } from '@playwright/test';
import { BlacklistMap, isBlacklisted } from './blacklist';
import { LocatorContentError, LocatorNotFoundError } from './logging';
import { JobSearchRecord } from './record-types';

const outputPath = path.resolve('data/search-results.json');
const today = DateTime.local().toISODate()!;

export type JobRecordLocators = {
    rows: string;
    title: (row: Locator) => Locator;
    company: (row: Locator) => Locator;
    location: (row: Locator) => Locator;
    url?: (row: Locator) => Locator;
    resolveUrl?: (row: Locator) => Promise<string | undefined> | string | undefined;
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
        const titleLocator = locators.title(row).first();
        const title = await titleLocator.count() === 1
            ? (await titleLocator.textContent()) ?? 'LocatorNoText'
            : 'NoLocator';
        const companyLocator = locators.company(row).first();
        const company = await companyLocator.count() === 1
            ? (await companyLocator.textContent()) ?? 'LocatorNoText'
            : 'NoLocator';
        const locationLocator = locators.location(row).first();
        const location = await locationLocator.count() === 1
            ? (await locationLocator.textContent()) ?? 'LocatorNoText'
            : 'NoLocator';
        const url = locators.url ? await locators.url(row).first().getAttribute('href') : await locators.resolveUrl?.(row);

        const record = {
            id: randomUUID(),
            date: today,
            title: title.replace(/\s+/g, ' ').trim(),
            company: company.replace(/\s+/g, ' ').trim(),
            location: location.replace(/\s+/g, ' ').trim(),
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
        if (await nextPage.count() === 0 || !(await nextPage.isEnabled())) {
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
    const locatorMap: Array<[string, Locator]> = [
        ['Title', locators.title(row)],
        ['Company', locators.company(row)],
        ['Location', locators.location(row)],
    ];
    if (locators.url) {
        locatorMap.push(['URL', locators.url(row)]);
    }
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

export async function getBrokenRecordCount(records: JobSearchRecord[]) {
    let count = 0;
    records.forEach((record) => {
        if (
            record.title === 'NoLocator' ||
            record.company === 'NoLocator' ||
            record.location === 'NoLocator' ||
            record.title === 'LocatorNoText' ||
            record.company === 'LocatorNoText' ||
            record.location === 'LocatorNoText'
        ) {
            count++;
        }
    });

    return count;
}

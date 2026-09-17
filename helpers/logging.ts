import type { TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { DateTime } from 'luxon';
import path from 'path';
import { JobSearchRecord } from './record-types';

export class LocatorNotFoundError extends Error {
    static readonly defaultMessage = '\nCheck if the identified locator type(s) are still correct.';

    constructor(message: string) {
        super(`${message} ${LocatorNotFoundError.defaultMessage}`);
        this.name = 'LocatorNotFoundError';
    }
}

export class LocatorContentError extends Error {
    static readonly defaultMessage = '\nLocator(s) may have been present on the page but don\'t contain the expected content.';

    constructor(message: string) {
        super(`${message} ${LocatorContentError.defaultMessage}`);
        this.name = 'LocatorContentError';
    }
}

export async function logTestResult(testInfo: TestInfo, records: JobSearchRecord[]) {
    const logInfo: string[] = [];
    const logTime = DateTime.local();
    logInfo.push("==============================");
    logInfo.push(`Executed on ${logTime.toFormat("yyyy-MM-dd HH:mm:ss")}`);
    logInfo.push(`${testInfo.title}`);
    logInfo.push(`Status: ${testInfo.status}`);
    logInfo.push(`Duration: ${testInfo.duration}ms`);
    logInfo.push(`Records scraped: ${records.length}`);

    if (testInfo.error) {
        const errorInfo: string[] = [];
        errorInfo.push(`Scrape error: ${testInfo.error.message}`);

        if (testInfo.error.stack) {
            errorInfo.push(testInfo.error.stack);
        } else if (testInfo.error.value) {
            errorInfo.push(testInfo.error.value);
        }

        await writeLogFile(`errors-${logTime.toFormat("yyyy-MM-dd'T'HH-mm-ss")}.log`, errorInfo);
    }

    await writeLogFile('scrape-results.log', logInfo, true);
}

async function writeLogFile(fileName: string, lines: string[], append = false) {
    const logsPath = path.resolve('logs');
    await mkdir(logsPath, { recursive: true });

    const filePath = path.join(logsPath, fileName);
    let contents = `${lines.join('\n')}\n`;
    if (append) {
        let existingContents = '';
        try {
            existingContents = await readFile(filePath, 'utf8');
        } catch (error) {
            if ((error as { code?: string }).code !== 'ENOENT') {
                throw error;
            }
        }

        contents = contents.concat(existingContents);
    }

    await writeFile(filePath, contents, 'utf8');
}

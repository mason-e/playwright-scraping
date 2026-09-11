import { readFile } from 'fs/promises';
import path from 'path';
import type { JobSearchRecord } from './record-types';

export type BlacklistField = 'title' | 'company' | 'location';

export type BlacklistEntry = {
    value: string;
    field: BlacklistField;
    dateAdded: string;
    reason?: string;
};

export type BlacklistMap = Record<BlacklistField, string[]>;

const blacklistFields: BlacklistField[] = ['title', 'company', 'location'];

export function normalizeBlacklistEntries(entries: BlacklistEntry[] | undefined): BlacklistMap {
    const normalized: BlacklistMap = {
        title: [],
        company: [],
        location: [],
    };

    for (const entry of entries ?? []) {
        if (!entry || typeof entry.value !== 'string' || !blacklistFields.includes(entry.field as BlacklistField)) {
            continue;
        }

        const value = entry.value.trim();
        if (value.length === 0) {
            continue;
        }

        normalized[entry.field].push(value);
    }

    return normalized;
}

export async function loadBlacklist(baseDir = path.resolve('data')): Promise<BlacklistMap> {
    const filePath = path.join(baseDir, 'blacklist.json');

    try {
        const contents = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(contents) as BlacklistEntry[];
        return normalizeBlacklistEntries(parsed);
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            return {
                title: [],
                company: [],
                location: [],
            };
        }

        throw error;
    }
}

export function isBlacklisted(record: JobSearchRecord, blacklist: BlacklistMap): boolean {
    return (Object.entries(blacklist) as [BlacklistField, string[]][]).some(([field, values]) =>
        values.some((value) => record[field].toLowerCase().includes(value.toLowerCase()))
    );
}

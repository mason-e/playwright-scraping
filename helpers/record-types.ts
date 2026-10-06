export type JobSearchRecord = {
    id: string;
    title: string;
    company: string;
    location: string;
    isRead: boolean;
    url?: string;
}

export type JobApplicationRecord = {
    id: string;
    company: string;
    title: string;
    appDate: string;
    appMethod: string;
    location: string;
    interviewed: boolean;
    advanced: boolean;
    contact?: string;
}
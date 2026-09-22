import { openDB } from "idb";

const OUTBOX_KEY = "nadi-kota-report-outbox";
const DB_NAME = "nadi-kota";
const STORE_NAME = "report-outbox";

function getDatabase() {
  return openDB(DB_NAME, 1, {
    upgrade(db) { db.createObjectStore(STORE_NAME); },
  });
}

export interface OfflineReport {
  id: string;
  category: "pothole" | "street_light" | "other";
  latitude: number;
  longitude: number;
  photo: Blob;
}

export async function readReportOutbox(): Promise<OfflineReport[]> {
  return (await (await getDatabase()).get(STORE_NAME, OUTBOX_KEY)) ?? [];
}

export async function enqueueReport(report: OfflineReport): Promise<void> {
  await (await getDatabase()).put(STORE_NAME, [...await readReportOutbox(), report], OUTBOX_KEY);
}

export async function removeReportFromOutbox(id: string): Promise<void> {
  await (await getDatabase()).put(STORE_NAME, (await readReportOutbox()).filter((report) => report.id !== id), OUTBOX_KEY);
}

export async function clearReportOutbox(): Promise<void> {
  await (await getDatabase()).delete(STORE_NAME, OUTBOX_KEY);
}
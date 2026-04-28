export type ProductInteractionEventType =
  | "ORDER"
  | "CART"
  | "WISHLIST"
  | "VIEW";

export type ProductInteractionRecord = {
  userId: string;
  productId: string;
  eventType: ProductInteractionEventType;
  lastInteractedAt: string;
};

type RecordInput = {
  userId?: string | null;
  productId: string;
  eventType: ProductInteractionEventType;
  interactedAt?: Date;
};

const PRODUCT_INTERACTION_STORAGE_KEY = "productInteractions.v1";
const MAX_STORED_RECORDS = 1200;
const MAX_KEEP_DAYS = 30;

function normalizeUserId(userId?: string | null): string {
  const normalized = userId?.trim();
  return normalized || "anonymous";
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRawRecords(): ProductInteractionRecord[] {
  const raw = window.localStorage.getItem(PRODUCT_INTERACTION_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!isObject(item)) {
          return null;
        }

        const userId =
          typeof item.userId === "string" && item.userId.trim().length > 0
            ? item.userId.trim()
            : "anonymous";

        const productId =
          typeof item.productId === "string" ? item.productId.trim() : "";

        const eventType =
          typeof item.eventType === "string"
            ? item.eventType.toUpperCase()
            : "";

        const lastInteractedAt =
          typeof item.lastInteractedAt === "string"
            ? item.lastInteractedAt
            : "";

        if (!productId || !parseDate(lastInteractedAt)) {
          return null;
        }

        if (
          eventType !== "ORDER" &&
          eventType !== "CART" &&
          eventType !== "WISHLIST" &&
          eventType !== "VIEW"
        ) {
          return null;
        }

        return {
          userId,
          productId,
          eventType,
          lastInteractedAt,
        } as ProductInteractionRecord;
      })
      .filter((item): item is ProductInteractionRecord => Boolean(item));
  } catch {
    return [];
  }
}

function toDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function cleanupRecords(
  records: ProductInteractionRecord[],
): ProductInteractionRecord[] {
  const now = new Date();
  const minTimestamp =
    toDayStart(now).getTime() - MAX_KEEP_DAYS * 24 * 60 * 60 * 1000;

  const dedup = new Map<string, ProductInteractionRecord>();

  records.forEach((record) => {
    const recordDate = parseDate(record.lastInteractedAt);
    if (!recordDate || recordDate.getTime() < minTimestamp) {
      return;
    }

    const key = `${record.userId}|${record.productId}|${record.eventType}`;
    const existing = dedup.get(key);

    if (!existing) {
      dedup.set(key, record);
      return;
    }

    const existingDate = parseDate(existing.lastInteractedAt);
    if (!existingDate || recordDate > existingDate) {
      dedup.set(key, record);
    }
  });

  return Array.from(dedup.values())
    .sort((a, b) => {
      const dateA = parseDate(a.lastInteractedAt)?.getTime() ?? 0;
      const dateB = parseDate(b.lastInteractedAt)?.getTime() ?? 0;
      return dateB - dateA;
    })
    .slice(0, MAX_STORED_RECORDS);
}

function writeRecords(records: ProductInteractionRecord[]): void {
  const cleaned = cleanupRecords(records);
  window.localStorage.setItem(
    PRODUCT_INTERACTION_STORAGE_KEY,
    JSON.stringify(cleaned),
  );
}

export function isSameLocalDay(isoDate: string, against = new Date()): boolean {
  const date = parseDate(isoDate);
  if (!date) {
    return false;
  }

  return (
    date.getFullYear() === against.getFullYear() &&
    date.getMonth() === against.getMonth() &&
    date.getDate() === against.getDate()
  );
}

export function getTodayProductInteractions(
  userId: string,
  now = new Date(),
): ProductInteractionRecord[] {
  const normalizedUserId = normalizeUserId(userId);

  return readRawRecords().filter(
    (record) =>
      record.userId === normalizedUserId &&
      isSameLocalDay(record.lastInteractedAt, now),
  );
}

export function recordProductInteraction({
  userId,
  productId,
  eventType,
  interactedAt,
}: RecordInput): void {
  const normalizedProductId = productId.trim();
  if (!normalizedProductId) {
    return;
  }

  const normalizedUserId = normalizeUserId(userId);
  const timestamp = (interactedAt ?? new Date()).toISOString();

  const current = readRawRecords();
  current.push({
    userId: normalizedUserId,
    productId: normalizedProductId,
    eventType,
    lastInteractedAt: timestamp,
  });

  writeRecords(current);
}

export function recordProductInteractionsBatch(
  events: Array<
    Omit<RecordInput, "interactedAt"> & {
      interactedAt?: Date;
    }
  >,
): void {
  if (events.length === 0) {
    return;
  }

  const current = readRawRecords();

  events.forEach((event) => {
    const normalizedProductId = event.productId.trim();
    if (!normalizedProductId) {
      return;
    }

    current.push({
      userId: normalizeUserId(event.userId),
      productId: normalizedProductId,
      eventType: event.eventType,
      lastInteractedAt: (event.interactedAt ?? new Date()).toISOString(),
    });
  });

  writeRecords(current);
}

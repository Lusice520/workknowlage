import { getWorkKnowlageApi } from '../../shared/lib/workKnowlageApi';
import type { QuickNoteRecord } from '../../shared/types/workspace';

const quickNoteRecordCache = new Map<string, Promise<QuickNoteRecord | null>>();
const resolvedQuickNoteRecordCache = new Map<string, QuickNoteRecord | null>();

export function prefetchQuickNoteRecord(noteDate: string) {
  const cacheKey = noteDate;
  const cachedPromise = quickNoteRecordCache.get(cacheKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const nextPromise = getWorkKnowlageApi().quickNotes.get(noteDate).then((note) => {
    resolvedQuickNoteRecordCache.set(cacheKey, note);
    return note;
  });
  quickNoteRecordCache.set(cacheKey, nextPromise);
  return nextPromise;
}

export function cacheQuickNoteRecord(noteDate: string, note: QuickNoteRecord) {
  const cacheKey = noteDate;
  quickNoteRecordCache.set(cacheKey, Promise.resolve(note));
  resolvedQuickNoteRecordCache.set(cacheKey, note);
}

export function getCachedQuickNoteRecord(noteDate: string) {
  return resolvedQuickNoteRecordCache.get(noteDate) ?? null;
}

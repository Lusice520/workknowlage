import { describe, expect, test } from 'vitest';
import {
  buildDefaultRichTableDoc,
  getRichTableColumnCount,
  getRichTableTableMinWidth,
  getRichTableTrackMinWidth,
  RICH_TABLE_DEFAULT_COLUMN_COUNT,
  RICH_TABLE_SCROLL_COLUMN_THRESHOLD,
} from './richTableLayout';

describe('richTableLayout', () => {
  test('builds new rich tables with 3 columns by default', () => {
    const doc = buildDefaultRichTableDoc();
    const rows = doc.content?.[0]?.content ?? [];
    const headerCells = rows[0]?.content ?? [];
    const bodyCells = rows[1]?.content ?? [];

    expect(RICH_TABLE_DEFAULT_COLUMN_COUNT).toBe(3);
    expect(headerCells).toHaveLength(3);
    expect(bodyCells).toHaveLength(3);
    expect(headerCells[2]?.content?.[0]?.content?.[0]?.text).toBe('列 3');
    expect(headerCells.map((cell: any) => cell?.attrs?.colwidth ?? null)).toEqual([[160], [160], [160]]);
    expect(bodyCells.map((cell: any) => cell?.attrs?.colwidth ?? null)).toEqual([[160], [160], [160]]);
  });

  test('starts narrow below the 6-column scroll threshold and only uses wide scrolling widths for larger tables', () => {
    expect(RICH_TABLE_SCROLL_COLUMN_THRESHOLD).toBe(6);
    expect(getRichTableTableMinWidth(3)).toBe('480px');
    expect(getRichTableTrackMinWidth(3)).toBe('480px');
    expect(getRichTableTableMinWidth(5)).toBe('800px');
    expect(getRichTableTrackMinWidth(5)).toBe('800px');
    expect(getRichTableTableMinWidth(6)).toBe('960px');
    expect(getRichTableTrackMinWidth(6)).toBe('960px');
    expect(getRichTableTableMinWidth(7)).toBe('1120px');
    expect(getRichTableTrackMinWidth(7)).toBe('1120px');
  });

  test('counts columns from the first row of the table document', () => {
    const doc = buildDefaultRichTableDoc(6);
    expect(getRichTableColumnCount(doc)).toBe(6);
  });
});

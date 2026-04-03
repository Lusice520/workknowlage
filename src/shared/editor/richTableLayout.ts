export const RICH_TABLE_DEFAULT_COLUMN_COUNT = 3;
export const RICH_TABLE_SCROLL_COLUMN_THRESHOLD = 6;
export const RICH_TABLE_MIN_COLUMN_WIDTH = 160;

export const buildDefaultRichTableDoc = (columnCount = RICH_TABLE_DEFAULT_COLUMN_COUNT): any => {
  const normalizedColumnCount = Math.max(1, Math.floor(columnCount || RICH_TABLE_DEFAULT_COLUMN_COUNT));

  return {
    type: 'doc',
    content: [
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: Array.from({ length: normalizedColumnCount }, (_, index) => ({
              type: 'tableHeader',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: `列 ${index + 1}` }],
                },
              ],
            })),
          },
          {
            type: 'tableRow',
            content: Array.from({ length: normalizedColumnCount }, () => ({
              type: 'tableCell',
              content: [{ type: 'paragraph' }],
            })),
          },
        ],
      },
    ],
  };
};

export const getRichTableColumnCount = (doc: any) => {
  const tableNode = doc?.content?.find?.((node: any) => node?.type === 'table');
  const firstRow = Array.isArray(tableNode?.content) ? tableNode.content[0] : null;
  const cellCount = Array.isArray(firstRow?.content) ? firstRow.content.length : 0;
  return cellCount > 0 ? cellCount : RICH_TABLE_DEFAULT_COLUMN_COUNT;
};

export const getRichTableTrackMinWidth = (columnCount: number) => {
  const normalizedColumnCount = Math.max(1, Math.floor(columnCount || RICH_TABLE_DEFAULT_COLUMN_COUNT));

  if (normalizedColumnCount < RICH_TABLE_SCROLL_COLUMN_THRESHOLD) {
    return '100%';
  }

  return `${normalizedColumnCount * RICH_TABLE_MIN_COLUMN_WIDTH}px`;
};

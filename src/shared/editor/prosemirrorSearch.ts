import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type ProseMirrorSearchMatch = {
  from: number;
  text: string;
  to: number;
};

const normalizeQuery = (query: string) => String(query || '').trim().toLowerCase();

const buildClassName = (classes: Array<string | undefined>) => classes.filter(Boolean).join(' ');

export function findProseMirrorMatches(doc: ProseMirrorNode, query: string): ProseMirrorSearchMatch[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const matches: ProseMirrorSearchMatch[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return true;
    }

    const text = node.text;
    const normalizedText = text.toLowerCase();
    let startIndex = 0;

    while (startIndex <= normalizedText.length) {
      const foundIndex = normalizedText.indexOf(normalizedQuery, startIndex);
      if (foundIndex < 0) {
        break;
      }

      matches.push({
        from: pos + foundIndex,
        to: pos + foundIndex + normalizedQuery.length,
        text: text.slice(foundIndex, foundIndex + normalizedQuery.length),
      });

      startIndex = foundIndex + normalizedQuery.length;
    }

    return true;
  });

  return matches;
}

export function createProseMirrorSearchDecorations(
  doc: ProseMirrorNode,
  matches: ProseMirrorSearchMatch[],
  activeIndex: number,
  classes?: { matchClass?: string; activeMatchClass?: string }
): DecorationSet {
  if (!Array.isArray(matches) || matches.length === 0) {
    return DecorationSet.empty;
  }

  const matchClass = classes?.matchClass || 'wk-search-match';
  const activeMatchClass = classes?.activeMatchClass || 'wk-search-match-active';

  const decorations = matches.map((match, index) => {
    const className = buildClassName([
      matchClass,
      index === activeIndex ? activeMatchClass : undefined,
    ]);

    return Decoration.inline(match.from, match.to, { class: className });
  });

  return DecorationSet.create(doc, decorations);
}

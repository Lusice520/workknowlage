import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const walkSourceFiles = (relativeDir: string): string[] => {
  const absoluteDir = path.join(repoRoot, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      return walkSourceFiles(relativePath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
};

describe('P1-1 boundary contracts', () => {
  test('AppShell keeps a narrow prop surface', () => {
    const source = read('src/features/shell/AppShell.tsx');
    const propsBlock = source.match(/interface AppShellProps \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const propNames = [...propsBlock.matchAll(/^\s+([a-zA-Z0-9_]+)\??:/gm)].map((match) => match[1]);

    expect(propNames).toEqual(['documentNavigationFeedback']);
  });

  test('feature components do not import the runtime API directly', () => {
    const offenders = walkSourceFiles('src/features').filter((filePath) =>
      read(filePath).includes('getWorkKnowlageApi')
    );

    expect(offenders).toEqual([]);
  });

  test('workKnowlageApi remains runtime wiring rather than mock implementation', () => {
    const source = read('src/shared/lib/workKnowlageApi.ts');

    expect(source).toContain('createMutableFallbackDesktopApi');
    expect(source).not.toContain('extractSearchableText');
    expect(source).not.toContain('ensureFolderMoveIsValid');
    expect(source).not.toContain('rebuildBacklinksForSpace');
  });

  test('tree package collection has one shared implementation', () => {
    expect(read('src/shared/lib/workKnowlageTree.ts')).toContain('export const collectTreePackageIds');
    expect(read('src/app/useWorkspaceContentActions.ts')).toContain("from '../shared/lib/workKnowlageTree'");
    expect(read('src/shared/lib/workKnowlageApi.mock.ts')).toContain("from './workKnowlageTree'");
  });
});

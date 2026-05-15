import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const shellDir = path.resolve(__dirname);
const appDir = path.resolve(__dirname, '../../app');

const read = (absolutePath: string) => fs.readFileSync(absolutePath, 'utf8');

test('keeps association derivation out of RightSidebar render path', () => {
  const rightSidebarSource = read(path.join(shellDir, 'RightSidebar.tsx'));
  const appShellSource = read(path.join(shellDir, 'AppShell.tsx'));
  const hookSource = read(path.join(appDir, 'useSidebarAssociations.ts'));

  expect(rightSidebarSource).not.toContain('deriveSidebarAssociations');
  expect(rightSidebarSource).toContain('associationState = emptyAssociationState');
  expect(appShellSource).toContain("from '../../app/useSidebarAssociations'");
  expect(appShellSource).toContain('const associationState = useSidebarAssociations({');
  expect(appShellSource).toContain('associationState={associationState}');
  expect(hookSource.split('\n').length).toBeLessThan(220);
  expect(hookSource).toContain('const sidebarAssociationsCache = new Map');
  expect(hookSource).toContain('window.setTimeout');
});

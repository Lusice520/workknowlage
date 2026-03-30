import fs from 'node:fs';
import path from 'node:path';

test('sidebar and export menus share the same menu style constants', () => {
  const sidebarMenuPath = path.resolve(__dirname, 'SidebarActionMenu.tsx');
  const centerPanePath = path.resolve(__dirname, 'CenterPane.tsx');
  const sidebarMenuSource = fs.readFileSync(sidebarMenuPath, 'utf8');
  const centerPaneSource = fs.readFileSync(centerPanePath, 'utf8');

  expect(sidebarMenuSource).toContain(`from './sharedMenuStyles'`);
  expect(centerPaneSource).toContain(`from './sharedMenuStyles'`);
  expect(sidebarMenuSource).toContain('sharedMenuDropdownClassName');
  expect(sidebarMenuSource).toContain('sharedMenuItemClassName');
  expect(centerPaneSource).toContain('sharedMenuDropdownClassName');
  expect(centerPaneSource).toContain('sharedMenuItemClassName');
});

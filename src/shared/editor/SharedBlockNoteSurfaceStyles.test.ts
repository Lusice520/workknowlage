import fs from 'node:fs';
import path from 'node:path';

test('styles blocknote list markers through before pseudo-elements', () => {
  const cssPath = path.resolve(__dirname, 'SharedBlockNoteSurface.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  expect(css).toContain('--kb-body-font-size: 13.5px;');
  expect(css).toContain('--kb-body-line-height: 1.8;');
  expect(css).toContain('--kb-heading-padding-top: 10px;');
  expect(css).toContain('--kb-heading-padding-bottom: 12px;');
  expect(css).toContain('--kb-editor-font-family: var(--wk-font-family);');
  expect(css).toContain('--kb-body-text-color: #0D0D0D;');
  expect(css).toContain('.bn-block-content[data-content-type="bulletListItem"]:before');
  expect(css).toContain('.bn-block-content[data-content-type="numberedListItem"]:before');
  expect(css).toContain('--kb-list-marker-column: 28px;');
  expect(css).toContain('--kb-list-indent: 18px;');
  expect(css).toContain('--kb-list-guide-offset: 10px;');
  expect(css).toContain('--kb-bullet-marker-size: 20px;');
expect(css).toContain(`.shared-blocknote-surface .bn-block-content[data-content-type="paragraph"],
.shared-blocknote-surface .bn-block-content[data-content-type="quote"] {
  font-size: var(--kb-body-font-size);
  line-height: var(--kb-body-line-height);
  font-weight: 450;
  color: var(--kb-body-text-color);
}`);
expect(css).toContain(`.shared-blocknote-surface .bn-block-content[data-content-type="bulletListItem"],
.shared-blocknote-surface .bn-block-content[data-content-type="numberedListItem"],
.shared-blocknote-surface .bn-block-content[data-content-type="checkListItem"] {
  font-size: var(--kb-body-font-size);
  font-weight: 450;
  color: var(--kb-body-text-color);
}`);
expect(css).toContain(`.shared-blocknote-surface .bn-container,
.shared-blocknote-surface .bn-default-styles {
  font-size: var(--kb-body-font-size);
  font-family: var(--kb-editor-font-family);
  font-weight: 450;
  color: var(--kb-body-text-color);
}`);
  expect(css).toContain(`.shared-blocknote-surface .bn-block-content[data-content-type="bulletListItem"],
.shared-blocknote-surface .bn-block-content[data-content-type="numberedListItem"],
.shared-blocknote-surface .bn-react-node-view-renderer > .bn-block-content[data-content-type="bulletListItem"],
.shared-blocknote-surface .bn-react-node-view-renderer > .bn-block-content[data-content-type="numberedListItem"] {
  align-items: baseline;
}`);
  expect(css).toContain('.shared-blocknote-surface .bn-block-content[data-content-type="bulletListItem"]:before,');
  expect(css).toContain('font-size: var(--kb-bullet-marker-size);');
  expect(css).not.toContain('font-weight: 700;');
  expect(css).toContain('line-height: 1;');
  expect(css).not.toContain('transform: translateY(-1px);');
  expect(css).not.toContain('width: calc(100% + var(--kb-list-marker-column));');
  expect(css).not.toContain('margin-left: calc(var(--kb-list-marker-column) * -1);');
  expect(css).not.toContain('padding-left: var(--kb-list-marker-column);');
  expect(css).toContain('.shared-blocknote-surface .bn-block-group .bn-block-group {');
  expect(css).toContain('margin-left: var(--kb-list-indent);');
  expect(css).toContain('.shared-blocknote-surface .bn-block-group .bn-block-group > .bn-block-outer:not([data-prev-depth-changed]):before {');
  expect(css).toContain('left: calc(var(--kb-list-guide-offset) * -1);');
  expect(css).toContain('.shared-blocknote-surface .bn-default-styles');
  expect(css).toContain('.shared-blocknote-surface [data-content-type="divider"] hr');
  expect(css).toContain(`.shared-blocknote-surface .bn-block-outer > .bn-block > .bn-block-content[data-content-type="heading"],
.shared-blocknote-surface .bn-block-outer > .bn-block > .bn-react-node-view-renderer > .bn-block-content[data-content-type="heading"] {
  font-size: var(--level) !important;
  line-height: 1.24 !important;
  letter-spacing: -0.035em;
  padding-top: var(--kb-heading-padding-top);
  padding-bottom: var(--kb-heading-padding-bottom);
  margin: 0;
}`);
});

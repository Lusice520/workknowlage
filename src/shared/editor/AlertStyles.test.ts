import fs from 'node:fs';
import path from 'node:path';

test('styles alert containers from the shared block wrapper when they have child blocks', () => {
  const cssPath = path.resolve(__dirname, 'Alert.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  expect(css).toContain('.bn-block:has(> .bn-block-content[data-content-type="alert"])');
  expect(css).toContain('.bn-block:has(> .bn-react-node-view-renderer > .bn-block-content[data-content-type="alert"])');
  expect(css).toContain('border: 1px solid #d8e0ff;');
  expect(css).toContain('border-radius: 6px;');
  expect(css).toContain('background-color: #eef1ff;');
  expect(css).toContain('.bn-block > .bn-react-node-view-renderer + .bn-block-group {');
  expect(css).toContain('background: transparent;');
  expect(css).toContain('border: none;');
  expect(css).toContain('.bn-block:has(> .bn-react-node-view-renderer > .bn-block-content[data-content-type="alert"][data-type="warning"])');
  expect(css).not.toContain('.bn-block > .bn-block-content[data-content-type="alert"][data-type="warning"] + .bn-block-group');
  expect(css).toContain('.bn-block:has(> .bn-block-content[data-content-type="alert"]) > .bn-block-group > .bn-block-outer:not([data-prev-depth-changed])::before');
  expect(css).toContain('.bn-block:has(> .bn-react-node-view-renderer > .bn-block-content[data-content-type="alert"]) > .bn-block-group > .bn-block-outer:not([data-prev-depth-changed])::before');
  expect(css).toContain('content: none;');
});

test('does not collapse the first empty alert body paragraph to zero vertical padding', () => {
  const cssPath = path.resolve(__dirname, 'Alert.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  expect(css).not.toContain(`.bn-block > .bn-block-content[data-content-type="alert"] + .bn-block-group > .bn-block-outer:first-child > .bn-block > .bn-block-content[data-content-type="paragraph"][data-is-empty-and-focused="true"],
.bn-block > .bn-block-content[data-content-type="alert"] + .bn-block-group > .bn-block-outer:first-child > .bn-block > .bn-block-content[data-content-type="paragraph"]:has(> .bn-inline-content > br.ProseMirror-trailingBreak),
.bn-block > .bn-react-node-view-renderer + .bn-block-group > .bn-block-outer:first-child > .bn-block > .bn-block-content[data-content-type="paragraph"][data-is-empty-and-focused="true"],
.bn-block > .bn-react-node-view-renderer + .bn-block-group > .bn-block-outer:first-child > .bn-block > .bn-block-content[data-content-type="paragraph"]:has(> .bn-inline-content > br.ProseMirror-trailingBreak) {
  padding-top: 0;
  padding-bottom: 0;
}`);
});

test('aligns alert child blocks with the alert text column', () => {
  const cssPath = path.resolve(__dirname, 'Alert.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  expect(css).toContain('--kb-alert-body-offset: 36px;');
  expect(css).toContain(`.bn-block > .bn-block-content[data-content-type="alert"] + .bn-block-group,
.bn-block > .bn-react-node-view-renderer + .bn-block-group {
  margin: 0;
  padding: 0 14px 10px var(--kb-alert-body-offset);
  border: none;
  border-radius: 0;
  background: transparent;
}`);
  expect(css).not.toContain('padding: 0 14px 10px 40px;');
});

test('keeps the alert icon vertically aligned with the text after typography changes', () => {
  const cssPath = path.resolve(__dirname, 'Alert.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  expect(css).toContain('--kb-alert-line-height: var(--kb-body-line-height, 1.8);');
  expect(css).toContain('line-height: var(--kb-alert-line-height);');
  expect(css).toContain('height: var(--kb-alert-icon-wrapper-size);');
  expect(css).toContain('transform: translateY(calc(((1em * var(--kb-alert-line-height)) - var(--kb-alert-icon-wrapper-size)) / 2));');
  expect(css).not.toContain('transform: translateY(-2px);');
});

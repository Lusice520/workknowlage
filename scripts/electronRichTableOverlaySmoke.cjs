const fs = require('node:fs');
const path = require('node:path');

const readText = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const parseMatrixScenarios = (matrixSource) => matrixSource
  .split(/\r?\n/)
  .reduce((acc, line) => {
    const trimmed = line.trim();
    if (trimmed === '## Contract') {
      acc.collecting = true;
      return acc;
    }
    if (trimmed.startsWith('## ') && trimmed !== '## Contract') {
      acc.collecting = false;
      return acc;
    }
    if (acc.collecting && trimmed.startsWith('- ')) {
      acc.items.push(trimmed.slice(2).trim());
    }
    return acc;
  }, { collecting: false, items: [] }).items;

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runSmoke = () => {
  const matrixSource = readText('docs/plans/2026-04-05-rich-table-browser-regression-matrix.md');
  const scenarios = parseMatrixScenarios(matrixSource);

  const richTableSource = readText('src/shared/editor/RichTable.tsx');
  const overlaySource = readText('src/shared/editor/RichTableOverlay.tsx');
  const overlayModelSource = readText('src/shared/editor/useRichTableOverlayModel.ts');
  const columnWidthsSource = readText('src/shared/editor/richTableColumnWidths.ts');
  const commandsSource = readText('src/shared/editor/useRichTableCommands.ts');
  const uiStateSource = readText('src/shared/editor/richTableUiState.ts');
  const stylesSource = readText('src/shared/editor/RichTable.css');

  const checks = {
    richTableSource: richTableSource.includes('<RichTableOverlay')
      && !richTableSource.includes('createPortal(')
      && !richTableSource.includes('document.body'),
    overlaySource: overlaySource.includes('rt-top-toolbar-portal')
      && overlaySource.includes('rt-floating-controls-portal')
      && overlaySource.includes('equalizeTableColumnWidths'),
    overlayModelSource: overlayModelSource.includes('editorClip')
      && overlayModelSource.includes('toolbarViewportPosition')
      && overlayModelSource.includes('addColVisible')
      && overlayModelSource.includes('addRowVisible'),
    roundedCorners: stylesSource.includes('border-radius: 0 !important'),
    equalWidthAction: overlaySource.includes('调整相同宽度')
      && columnWidthsSource.includes('buildEqualizedRichTableColumnTransaction'),
    mergedCellGuardrail: commandsSource.includes('包含合并单元格时暂不支持调整相同宽度')
      && uiStateSource.includes('shouldShowRichTableToolbar'),
  };

  ensure(scenarios.length === 7, `Expected 7 matrix scenarios, found ${scenarios.length}`);
  ensure(Object.values(checks).every(Boolean), 'RichTable overlay smoke checks failed');

  return {
    ok: true,
    scenarios,
    checks,
  };
};

if (require.main === module) {
  const result = runSmoke();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

module.exports = { runSmoke };

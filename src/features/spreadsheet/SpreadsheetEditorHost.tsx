import { useEffect, useRef, useState } from 'react';
import { createUniver, LocaleType, type IWorkbookData } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { ChevronDown, Database, Home, Plus, Sigma } from 'lucide-react';
import type { SpreadsheetWorkbookRecord } from '../../shared/types/preload';
import type { DocumentRecord } from '../../shared/types/workspace';
import { useSpreadsheetPersistence, type SpreadsheetSaveStatus } from './useSpreadsheetPersistence';
import '@univerjs/preset-sheets-core/lib/index.css';
import './SpreadsheetEditor.css';

type DisposableLike = {
  dispose: () => void;
};

type SpreadsheetWorkbookHandle = {
  dispose?: () => void;
  onCommandExecuted: (callback: () => void) => DisposableLike;
  save: () => unknown;
};

type SpreadsheetLoadStatus = 'loading' | 'ready' | 'error';
type RibbonTabLabel = '开始' | '插入' | '公式' | '数据';

interface SpreadsheetEditorHostProps {
  document: DocumentRecord;
  onContentSnapshotReady?: (getContentJson: () => string) => void;
  onLoadSpreadsheetWorkbook: (documentId: string) => Promise<SpreadsheetWorkbookRecord | null>;
  onSaveStatusChange?: (status: SpreadsheetSaveStatus) => void;
  onSaveSpreadsheetWorkbook: (documentId: string, workbookJson: string) => Promise<SpreadsheetWorkbookRecord>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const createDefaultWorkbookData = (document: DocumentRecord): Partial<IWorkbookData> => ({
  id: `workbook-${document.id}`,
  name: document.title || '无标题表格',
  appVersion: '0.23.0',
  locale: LocaleType.ZH_CN,
  styles: {},
  sheetOrder: ['sheet-1'],
  sheets: {
    'sheet-1': {
      id: 'sheet-1',
      name: 'Sheet1',
      rowCount: 100,
      columnCount: 26,
      defaultColumnWidth: 88,
      defaultRowHeight: 24,
      cellData: {},
    },
  },
});

const normalizeWorkbookData = (
  document: DocumentRecord,
  rawWorkbookJson: string | null | undefined,
): Partial<IWorkbookData> => {
  const fallback = createDefaultWorkbookData(document);

  if (!rawWorkbookJson) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawWorkbookJson) as unknown;
    if (!isRecord(parsed)) {
      return fallback;
    }

    const sheets = (isRecord(parsed.sheets) && Object.keys(parsed.sheets).length > 0
      ? parsed.sheets
      : fallback.sheets) as Partial<IWorkbookData>['sheets'];
    const sheetOrder = Array.isArray(parsed.sheetOrder) && parsed.sheetOrder.length > 0
      ? parsed.sheetOrder.filter((item): item is string => typeof item === 'string')
      : Object.keys(sheets ?? {});

    return {
      ...fallback,
      ...parsed,
      id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id : fallback.id,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : fallback.name,
      appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : fallback.appVersion,
      locale: typeof parsed.locale === 'string' ? parsed.locale as LocaleType : fallback.locale,
      styles: (isRecord(parsed.styles) ? parsed.styles : fallback.styles) as Partial<IWorkbookData>['styles'],
      sheetOrder: sheetOrder.length > 0 ? sheetOrder : fallback.sheetOrder,
      sheets,
    };
  } catch (error) {
    console.warn('[SpreadsheetEditorHost] Stored workbook JSON is invalid; using a fresh workbook:', error);
    return fallback;
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : '请稍后重试';

const ribbonTabs: Array<{
  label: RibbonTabLabel;
  description: string;
  icon: typeof Home;
}> = [
  {
    label: '开始',
    description: '初始化工作表并设置基本参数。',
    icon: Home,
  },
  {
    label: '插入',
    description: '插入行、列、图表和各种其他元素。',
    icon: Plus,
  },
  {
    label: '公式',
    description: '使用函数和公式进行数据计算。',
    icon: Sigma,
  },
  {
    label: '数据',
    description: '管理数据，包括导入、排序和筛选。',
    icon: Database,
  },
];

const decorateUniverRibbon = (containerElement: HTMLElement) => {
  const tablist = containerElement.querySelector<HTMLElement>('[role="tablist"][aria-label="ribbon.menu"]');
  const ribbonRow = tablist?.parentElement;
  const toolbarRow = ribbonRow?.nextElementSibling;

  tablist?.setAttribute('aria-hidden', 'true');
  ribbonRow?.classList.add('wk-univer-ribbon-row');
  toolbarRow?.classList.add('wk-univer-toolbar-row');
};

export function SpreadsheetEditorHost({
  document,
  onContentSnapshotReady,
  onLoadSpreadsheetWorkbook,
  onSaveStatusChange,
  onSaveSpreadsheetWorkbook,
}: SpreadsheetEditorHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [workbookData, setWorkbookData] = useState<Partial<IWorkbookData> | null>(null);
  const [loadStatus, setLoadStatus] = useState<SpreadsheetLoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTabLabel>('开始');
  const [ribbonMenuOpen, setRibbonMenuOpen] = useState(false);
  const { attachWorkbook, getWorkbookJson, scheduleSave } = useSpreadsheetPersistence({
    documentId: document.id,
    onSaveStatusChange,
    onSaveSpreadsheetWorkbook,
  });

  useEffect(() => {
    let cancelled = false;

    setWorkbookData(null);
    setLoadError(null);
    setLoadStatus('loading');
    attachWorkbook(null);

    void onLoadSpreadsheetWorkbook(document.id)
      .then((record) => {
        if (cancelled) {
          return;
        }

        setWorkbookData(normalizeWorkbookData(document, record?.workbookJson));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error('[SpreadsheetEditorHost] Failed to load workbook:', error);
        setLoadError(getErrorMessage(error));
        setLoadStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [attachWorkbook, document, onLoadSpreadsheetWorkbook]);

  useEffect(() => {
    onContentSnapshotReady?.(() => getWorkbookJson(workbookData ?? createDefaultWorkbookData(document)));
  }, [document, getWorkbookJson, onContentSnapshotReady, workbookData]);

  useEffect(() => {
    const containerElement = containerRef.current;

    if (!containerElement || !workbookData) {
      return;
    }

    let commandDisposable: DisposableLike | null = null;
    let workbook: SpreadsheetWorkbookHandle | null = null;
    let univer: { dispose: () => void } | null = null;
    let rpcWorker: Worker | null = null;
    let ribbonObserver: MutationObserver | null = null;

    try {
      containerElement.innerHTML = '';
      const nextRpcWorker = new Worker(new URL('@univerjs/preset-sheets-core/worker', import.meta.url), {
        name: `workknowlage-spreadsheet-${document.id}`,
        type: 'module',
      });
      rpcWorker = nextRpcWorker;
      const created = createUniver({
        locale: LocaleType.ZH_CN,
        locales: {
          [LocaleType.ZH_CN]: sheetsCoreZhCN,
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerElement,
            disableAutoFocus: true,
            formulaBar: true,
            header: true,
            toolbar: true,
            workerURL: nextRpcWorker,
          }),
        ],
      });

      univer = created.univer;
      workbook = created.univerAPI.createWorkbook(workbookData) as SpreadsheetWorkbookHandle;
      attachWorkbook(workbook);
      commandDisposable = workbook.onCommandExecuted(() => {
        scheduleSave();
      });
      decorateUniverRibbon(containerElement);
      ribbonObserver = new MutationObserver(() => decorateUniverRibbon(containerElement));
      ribbonObserver.observe(containerElement, { childList: true, subtree: true });
      setLoadStatus('ready');
    } catch (error) {
      console.error('[SpreadsheetEditorHost] Failed to initialize Univer:', error);
      attachWorkbook(null);
      rpcWorker?.terminate();
      rpcWorker = null;
      setLoadError(getErrorMessage(error));
      setLoadStatus('error');
    }

    return () => {
      ribbonObserver?.disconnect();
      commandDisposable?.dispose();
      attachWorkbook(null);
      workbook?.dispose?.();
      univer?.dispose();
      rpcWorker?.terminate();
      containerElement.innerHTML = '';
    };
  }, [attachWorkbook, document.id, scheduleSave, workbookData]);

  const selectRibbonTab = (label: RibbonTabLabel) => {
    const tab = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="tablist"][aria-label="ribbon.menu"] [role="tab"]') ?? [],
    ).find((item) => item.textContent?.trim() === label);

    tab?.click();
    setActiveRibbonTab(label);
    setRibbonMenuOpen(false);
  };

  return (
    <section
      data-testid="spreadsheet-editor-host"
      className="wk-spreadsheet-host"
    >
      {loadStatus === 'ready' ? (
        <div className="wk-spreadsheet-ribbon-picker">
          <button
            type="button"
            className="wk-spreadsheet-ribbon-trigger"
            aria-haspopup="menu"
            aria-expanded={ribbonMenuOpen}
            onClick={() => setRibbonMenuOpen((current) => !current)}
          >
            <span>{activeRibbonTab}</span>
            <ChevronDown size={14} />
          </button>
          {ribbonMenuOpen ? (
            <div className="wk-spreadsheet-ribbon-menu" role="menu">
              {ribbonTabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.label}
                    type="button"
                    role="menuitem"
                    className="wk-spreadsheet-ribbon-item"
                    onClick={() => selectRibbonTab(tab.label)}
                  >
                    <span className="wk-spreadsheet-ribbon-icon" aria-hidden="true">
                      <Icon size={19} />
                    </span>
                    <span className="wk-spreadsheet-ribbon-copy">
                      <span className="wk-spreadsheet-ribbon-title">{tab.label}</span>
                      <span className="wk-spreadsheet-ribbon-description">{tab.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="wk-spreadsheet-container"
        aria-hidden={loadStatus === 'error'}
      />
      {loadStatus === 'loading' ? (
        <div className="wk-spreadsheet-state" role="status">正在加载表格...</div>
      ) : null}
      {loadStatus === 'error' ? (
        <div className="wk-spreadsheet-state wk-spreadsheet-state-error" role="alert">
          表格加载失败：{loadError}
        </div>
      ) : null}
    </section>
  );
}

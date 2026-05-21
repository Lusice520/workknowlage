import { createContext, useContext } from 'react';

export interface ExportContextValue {
  exportBusy: boolean;
  exportStatusText: string | null | undefined;
  onExportMarkdown: () => Promise<void> | void;
  onExportPdf: () => Promise<void> | void;
  onExportSpreadsheet: () => Promise<void> | void;
  onExportWord: () => Promise<void> | void;
}

const ExportContext = createContext<ExportContextValue | null>(null);

export const ExportContextProvider = ExportContext.Provider;

export const useExportContext = (): ExportContextValue => {
  const ctx = useContext(ExportContext);
  if (!ctx) throw new Error('useExportContext 必须在 ExportContextProvider 内使用');
  return ctx;
};

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { SettingsModal } from './SettingsModal';

describe('SettingsModal', () => {
  test('renders maintenance actions in a modal shell', () => {
    render(
      <SettingsModal
        open
        runtimeStatus={{
          storageLabel: 'SQLite 本地数据库',
          summary: '会自动保存到本机',
          detail: '当前写入会持久化到本地数据库',
          isPersistent: true,
          tone: 'positive',
        }}
        persistenceFeedback="当前写入会持久化到本地数据库"
        storageInfo={{
          storagePath: '/Users/demo/Library/Application Support/WorkKnowlage/workknowlage.db',
          scopeLabel: '空间、文件夹、文档、快记',
        }}
        onClose={async () => {}}
        onOpenDataDirectory={async () => {}}
        onCreateBackup={async () => {}}
        onRestoreBackup={async () => {}}
        onRebuildSearchIndex={async () => {}}
        onInspectDocumentContentHealth={async () => {}}
        onCleanupOrphanAttachments={async () => {}}
      />
    );

    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开数据目录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建备份' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '从备份恢复' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '检查文稿格式' })).toBeInTheDocument();
  });

  test('does not rely on the inline space switcher settings panel', () => {
    render(
      <SettingsModal
        open
        runtimeStatus={{
          storageLabel: 'SQLite 本地数据库',
          summary: '会自动保存到本机',
          detail: '当前写入会持久化到本地数据库',
          isPersistent: true,
          tone: 'positive',
        }}
        persistenceFeedback="当前写入会持久化到本地数据库"
        onClose={async () => {}}
        onOpenDataDirectory={async () => {}}
        onCreateBackup={async () => {}}
        onRestoreBackup={async () => {}}
        onRebuildSearchIndex={async () => {}}
        onInspectDocumentContentHealth={async () => {}}
        onCleanupOrphanAttachments={async () => {}}
      />
    );

    expect(screen.queryByTestId('sidebar-settings-panel')).not.toBeInTheDocument();
  });

  test('renders document format health detail items when provided', () => {
    render(
      <SettingsModal
        open
        runtimeStatus={{
          storageLabel: 'SQLite 本地数据库',
          summary: '会自动保存到本机',
          detail: '当前写入会持久化到本地数据库',
          isPersistent: true,
          tone: 'positive',
        }}
        persistenceFeedback="当前写入会持久化到本地数据库"
        dataToolsFeedback="文稿 12 篇；旧格式 1 篇"
        dataToolsDetails={[
          { label: '总结', detail: '旧格式文稿', tone: 'warning' },
          { label: '2026-04-21', detail: '旧格式快记', tone: 'warning' },
        ]}
        onClose={async () => {}}
        onOpenDataDirectory={async () => {}}
        onCreateBackup={async () => {}}
        onRestoreBackup={async () => {}}
        onRebuildSearchIndex={async () => {}}
        onInspectDocumentContentHealth={async () => {}}
        onCleanupOrphanAttachments={async () => {}}
      />
    );

    expect(screen.getByText('体检明细')).toBeInTheDocument();
    expect(screen.getByText('总结')).toBeInTheDocument();
    expect(screen.getByText('旧格式文稿')).toBeInTheDocument();
    expect(screen.getByText('2026-04-21')).toBeInTheDocument();
    expect(screen.getByText('旧格式快记')).toBeInTheDocument();
  });
});

import React from 'react';
import { defaultProps } from '@blocknote/core';
import { createReactBlockSpec } from './blocknoteReactNoComments';
import { Menu } from '@mantine/core';
import { AlertTriangle, XCircle, Info, CheckCircle2, List, ListOrdered } from 'lucide-react';

import './Alert.css';

export const alertTypes = [
  {
    title: '警告',
    value: 'warning',
    icon: AlertTriangle,
    color: '#e69819',
    backgroundColor: {
      light: '#fff6e6',
      dark: '#805d20',
    },
  },
  {
    title: '错误',
    value: 'error',
    icon: XCircle,
    color: '#d80d0d',
    backgroundColor: {
      light: '#ffe6e6',
      dark: '#802020',
    },
  },
  {
    title: '提示',
    value: 'info',
    icon: Info,
    color: '#507aff',
    backgroundColor: {
      light: '#e6ebff',
      dark: '#203380',
    },
  },
  {
    title: '成功',
    value: 'success',
    icon: CheckCircle2,
    color: '#0bc10b',
    backgroundColor: {
      light: '#e6ffe6',
      dark: '#208020',
    },
  },
];

const ALERT_EXPORT_META: Record<string, { icon: string; label: string }> = {
  warning: { icon: '⚠', label: '警告' },
  error: { icon: '✖', label: '错误' },
  info: { icon: 'ℹ', label: '提示' },
  success: { icon: '✓', label: '成功' },
};

const getAlertExportMeta = (type: string) => ALERT_EXPORT_META[type] || ALERT_EXPORT_META.warning;

const appendListItemToAlert = (editor: any, block: any, listType: string) => {
  const existingChildren = Array.isArray(block.children) ? block.children : [];
  const updatedBlock = editor.updateBlock(block, {
    children: [
      ...existingChildren,
      {
        type: listType,
        content: [{ type: 'text', text: '' }],
      },
    ],
  });
  const insertedBlock = updatedBlock.children?.[updatedBlock.children.length - 1];
  if (insertedBlock?.id) {
    editor.setTextCursorPosition(insertedBlock.id, 'start');
  }
};

export const createAlert = createReactBlockSpec(
  {
    type: 'alert',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      type: {
        default: 'warning',
        values: ['warning', 'error', 'info', 'success'],
      },
    },
    content: 'inline',
  },
  {
    render: (props: any) => {
      const alertType = alertTypes.find((a) => a.value === props.block.props.type) || alertTypes[0];
      const Icon = alertType.icon;
      return (
        <div className="bn-alert" data-alert-type={props.block.props.type}>
          <Menu withinPortal={false} zIndex={999999}>
            <Menu.Target>
              <div className="bn-alert-icon-wrapper" contentEditable={false}>
                <Icon className="bn-alert-icon" data-alert-icon-type={props.block.props.type} size={20} />
              </div>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>提醒类型</Menu.Label>
              <Menu.Divider />
              {alertTypes.map((type) => {
                const ItemIcon = type.icon;
                return (
                  <Menu.Item
                    key={type.value}
                    leftSection={<ItemIcon className="bn-alert-icon" data-alert-icon-type={type.value} size={16} />}
                    onClick={() =>
                      props.editor.updateBlock(props.block, {
                        type: 'alert',
                        props: { type: type.value },
                      })
                    }
                  >
                    {type.title}
                  </Menu.Item>
                );
              })}
              <Menu.Divider />
              <Menu.Item leftSection={<List size={16} />} onClick={() => appendListItemToAlert(props.editor, props.block, 'bulletListItem')}>
                插入无序列表
              </Menu.Item>
              <Menu.Item leftSection={<ListOrdered size={16} />} onClick={() => appendListItemToAlert(props.editor, props.block, 'numberedListItem')}>
                插入有序列表
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <div className="inline-content" ref={props.contentRef} />
        </div>
      );
    },
    toExternalHTML: (props: any) => {
      const alertType = getAlertExportMeta(props.block.props.type);
      return (
        <div className={`bn-alert-export bn-alert-export-${props.block.props.type || 'warning'}`}>
          <span className="bn-alert-export-icon" aria-hidden="true">{alertType.icon}</span>
          <div className="bn-alert-export-content" ref={props.contentRef} />
        </div>
      );
    },
  }
);

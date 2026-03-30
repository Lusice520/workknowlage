import { Menu } from '@mantine/core';
import type { LucideIcon } from 'lucide-react';
import {
  sharedMenuDropdownClassName,
  sharedMenuItemClassName,
  sharedMenuItemLabelClassName,
  sharedMenuItemSectionClassName,
} from './sharedMenuStyles';

const triggerButtonClass =
  'rounded p-1 text-slate-400 transition-colors hover:bg-slate-200/50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400';

interface SidebarActionMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

interface SidebarActionMenuProps {
  triggerLabel: string;
  triggerTitle?: string;
  triggerIcon: JSX.Element;
  items: SidebarActionMenuItem[];
  menuPosition?: 'bottom-end' | 'bottom-start';
}

export function SidebarActionMenu({
  triggerLabel,
  triggerTitle,
  triggerIcon,
  items,
  menuPosition = 'bottom-end',
}: SidebarActionMenuProps): JSX.Element {
  return (
    <Menu
      withinPortal={false}
      position={menuPosition}
      offset={6}
      shadow="lg"
      trapFocus={false}
      transitionProps={{ duration: 0 }}
    >
      <Menu.Target>
        <button
          type="button"
          className={triggerButtonClass}
          aria-label={triggerLabel}
          title={triggerTitle ?? triggerLabel}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {triggerIcon}
        </button>
      </Menu.Target>
      <Menu.Dropdown className={sharedMenuDropdownClassName}>
        {items.map((item) => {
          const ItemIcon = item.icon;

          return (
            <Menu.Item
              key={item.label}
              leftSection={<ItemIcon size={14} className={item.destructive ? 'text-rose-500' : 'text-slate-500'} />}
              color={item.destructive ? 'red' : undefined}
              className={sharedMenuItemClassName}
              classNames={{
                item: sharedMenuItemClassName,
                itemLabel: sharedMenuItemLabelClassName,
                itemSection: sharedMenuItemSectionClassName,
              }}
              onClick={(event) => {
                event.stopPropagation();
                item.onClick();
              }}
            >
              {item.label}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}

import type { ReactNode } from 'react';
import { Badge, BadgeGroup } from '../../../node_modules/@blocknote/mantine/src/badge/Badge.js';
import { Button } from '../../../node_modules/@blocknote/mantine/src/menu/Button.js';
import {
  Menu,
  MenuDivider,
  MenuDropdown,
  MenuItem,
  MenuLabel,
  MenuTrigger,
} from '../../../node_modules/@blocknote/mantine/src/menu/Menu.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../../node_modules/@blocknote/mantine/src/popover/Popover.js';
import { Panel } from '../../../node_modules/@blocknote/mantine/src/panel/Panel.js';
import { PanelButton } from '../../../node_modules/@blocknote/mantine/src/panel/PanelButton.js';
import { PanelFileInput } from '../../../node_modules/@blocknote/mantine/src/panel/PanelFileInput.js';
import { PanelTab } from '../../../node_modules/@blocknote/mantine/src/panel/PanelTab.js';
import { PanelTextInput } from '../../../node_modules/@blocknote/mantine/src/panel/PanelTextInput.js';
import { SideMenu } from '../../../node_modules/@blocknote/mantine/src/sideMenu/SideMenu.js';
import { SideMenuButton } from '../../../node_modules/@blocknote/mantine/src/sideMenu/SideMenuButton.js';
import { SuggestionMenu } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/SuggestionMenu.js';
import { SuggestionMenuEmptyItem } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/SuggestionMenuEmptyItem.js';
import { SuggestionMenuItem } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/SuggestionMenuItem.js';
import { SuggestionMenuLabel } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/SuggestionMenuLabel.js';
import { SuggestionMenuLoader } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/SuggestionMenuLoader.js';
import { GridSuggestionMenu } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/gridSuggestionMenu/GridSuggestionMenu.js';
import { GridSuggestionMenuEmptyItem } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/gridSuggestionMenu/GridSuggestionMenuEmptyItem.js';
import { GridSuggestionMenuItem } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/gridSuggestionMenu/GridSuggestionMenuItem.js';
import { GridSuggestionMenuLoader } from '../../../node_modules/@blocknote/mantine/src/suggestionMenu/gridSuggestionMenu/GridSuggestionMenuLoader.js';
import { ExtendButton } from '../../../node_modules/@blocknote/mantine/src/tableHandle/ExtendButton.js';
import { TableHandle } from '../../../node_modules/@blocknote/mantine/src/tableHandle/TableHandle.js';
import { Toolbar } from '../../../node_modules/@blocknote/mantine/src/toolbar/Toolbar.js';
import { ToolbarButton } from '../../../node_modules/@blocknote/mantine/src/toolbar/ToolbarButton.js';
import { ToolbarSelect } from '../../../node_modules/@blocknote/mantine/src/toolbar/ToolbarSelect.js';
import { TextInput } from '../../../node_modules/@blocknote/mantine/src/form/TextInput.js';

// Comments stay disabled in this app, but BlockNote 0.48 expects the slots to
// exist on the component contract. Keep them as inert placeholders so we don't
// pull the comments UI and its private dependencies back into the runtime.
const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const NullCommentsComponent = () => null;

export const knowledgeBaseEditorComponents = {
  FormattingToolbar: {
    Root: Toolbar,
    Button: ToolbarButton,
    Select: ToolbarSelect,
  },
  FilePanel: {
    Root: Panel,
    Button: PanelButton,
    FileInput: PanelFileInput,
    TabPanel: PanelTab,
    TextInput: PanelTextInput,
  },
  GridSuggestionMenu: {
    Root: GridSuggestionMenu,
    Item: GridSuggestionMenuItem,
    EmptyItem: GridSuggestionMenuEmptyItem,
    Loader: GridSuggestionMenuLoader,
  },
  LinkToolbar: {
    Root: Toolbar,
    Button: ToolbarButton,
    Select: ToolbarSelect,
  },
  SideMenu: {
    Root: SideMenu,
    Button: SideMenuButton,
  },
  SuggestionMenu: {
    Root: SuggestionMenu,
    Item: SuggestionMenuItem,
    EmptyItem: SuggestionMenuEmptyItem,
    Label: SuggestionMenuLabel,
    Loader: SuggestionMenuLoader,
  },
  TableHandle: {
    Root: TableHandle,
    ExtendButton,
  },
  Generic: {
    Badge: {
      Root: Badge,
      Group: BadgeGroup,
    },
    Form: {
      Root: Passthrough,
      TextInput,
    },
    Menu: {
      Root: Menu,
      Trigger: MenuTrigger,
      Dropdown: MenuDropdown,
      Divider: MenuDivider,
      Label: MenuLabel,
      Item: MenuItem,
      Button,
    },
    Popover: {
      Root: Popover,
      Trigger: PopoverTrigger,
      Content: PopoverContent,
    },
    Toolbar: {
      Root: Toolbar,
      Button: ToolbarButton,
      Select: ToolbarSelect,
    },
  },
  Comments: {
    Comment: NullCommentsComponent,
    Editor: NullCommentsComponent,
    Card: Passthrough,
    CardSection: Passthrough,
    ExpandSectionsPrompt: NullCommentsComponent,
  },
};

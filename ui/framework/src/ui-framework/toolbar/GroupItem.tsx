/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { ActionButtonItemDef } from "../shared/Item";
import { ItemDefBase, BaseItemState } from "../shared/ItemDefBase";
import { GroupButtonProps, AnyItemDef } from "../shared/ItemProps";
import { Icon } from "../shared/IconComponent";
import { ItemList, ItemMap } from "../shared/ItemMap";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { PropsHelper } from "../utils/PropsHelper";

import {
  Item, HistoryTray, History, HistoryIcon, DefaultHistoryManager, HistoryEntry, ExpandableItem, GroupColumn,
  GroupTool, GroupToolExpander, Group as ToolGroupComponent, NestedGroup as NestedToolGroup, Direction,
} from "@bentley/ui-ninezone";

// -----------------------------------------------------------------------------
// GroupItemDef class
// -----------------------------------------------------------------------------

/** An Item that opens a group of items.
 */
export class GroupItemDef extends ActionButtonItemDef {
  public groupId: string;
  public direction: Direction;
  public itemsInColumn: number;
  public items: AnyItemDef[];
  private _itemList!: ItemList;
  private _itemMap!: ItemMap;

  constructor(groupItemProps: GroupButtonProps) {
    super(groupItemProps);

    this.groupId = (groupItemProps.groupId !== undefined) ? groupItemProps.groupId : "";
    this.direction = (groupItemProps.direction !== undefined) ? groupItemProps.direction : Direction.Bottom;
    this.itemsInColumn = (groupItemProps.itemsInColumn !== undefined) ? groupItemProps.itemsInColumn : 7;

    this.items = groupItemProps.items;
  }

  public get id(): string {
    return this.groupId;
  }

  public resolveItems(): void {
    if (this._itemList)
      return;

    this._itemList = new ItemList();
    this._itemMap = new ItemMap();

    this.items.map((value, _index) => {
      const item: ItemDefBase | undefined = value;
      const id: string = item ? item.id : "";

      if (item) {
        this._itemList.addItem(item);
        this._itemMap.set(id, item);
      }
    });
  }

  public getItemById(id: string): ItemDefBase | undefined {
    return this._itemMap.get(id);
  }

  public getItemByIndex(index: number): ItemDefBase | undefined {
    return this._itemList.items[index];
  }

  public get itemCount(): number {
    return this._itemList.items.length;
  }

  public execute(): void {
  }

  public toolbarReactNode(index?: number): React.ReactNode {
    const key = (index !== undefined) ? index.toString() : this.id;
    this.resolveItems();

    return (
      <GroupItem
        key={key}
        groupItemDef={this}
      />
    );
  }

}

// -----------------------------------------------------------------------------
// GroupItem class, props & state
// -----------------------------------------------------------------------------

interface HistoryItem {
  trayKey: string;
  columnIndex: number;
  itemKey: string;
}

interface ToolGroupItem {
  iconSpec?: string | React.ReactNode;
  label: string;
  trayId?: string;
}

interface ToolGroupColumn {
  items: Map<string, ToolGroupItem>;
}

interface ToolGroupTray {
  title: string;
  columns: Map<number, ToolGroupColumn>;
}

type ColumnItemMap = Map<string, ToolGroupItem>;

interface Props {
  groupItemDef: GroupItemDef;
}

interface State extends BaseItemState {
  groupItemDef: GroupItemDef;
  trayId: string;
  backTrays: ReadonlyArray<string>;
  trays: Map<string, ToolGroupTray>;
  history: History<HistoryItem>;
  isExtended: boolean;
}

/** Group Item React component.
 */
class GroupItem extends React.Component<Props, State> {

  /** @hidden */
  public readonly state: Readonly<State>;
  private _componentUnmounting = false;
  private _childSyncIds?: Set<string>;
  private _childRefreshRequired = false;

  constructor(props: Props, context?: any) {
    super(props, context);

    this._loadChildSyncIds(props);
    this.state = GroupItem.processGroupItemDef(this.props.groupItemDef);
  }

  private _loadChildSyncIds(props: Props) {
    if (props.groupItemDef && props.groupItemDef.items.length > 0) {
      props.groupItemDef.items.forEach((itemDef: AnyItemDef) => {
        const item: ItemDefBase | undefined = itemDef;
        if (item.stateSyncIds.length > 0) {
          if (undefined === this._childSyncIds)
            this._childSyncIds = new Set<string>();
          item.stateSyncIds.forEach((value) => this._childSyncIds!.add(value));
        }
      });
    }
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if (this._componentUnmounting) return;

    let refreshState = false;

    if (this._childSyncIds && this._childSyncIds.size > 0)
      if ([...this._childSyncIds].some((value: string): boolean => args.eventIds.has(value)))
        this._childRefreshRequired = true;  // this is cleared when render occurs

    let newState: State = { ...this.state };

    if (this.props.groupItemDef.stateSyncIds && this.props.groupItemDef.stateSyncIds.length > 0)
      refreshState = this.props.groupItemDef.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));
    if (refreshState || this._childRefreshRequired) {
      if (this.props.groupItemDef.stateFunc)
        newState = this.props.groupItemDef.stateFunc(newState) as State;
      if ((this.state.isActive !== newState.isActive) || (this.state.isEnabled !== newState.isEnabled) || (this.state.isVisible !== newState.isVisible)
        || this._childRefreshRequired) {
        this.setState((_prevState) => ({ isActive: newState.isActive, isEnabled: newState.isEnabled, isVisible: newState.isVisible, isPressed: newState.isPressed }));
      }
    }
  }

  public componentDidMount() {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
  }

  public shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (!PropsHelper.isShallowEqual(nextState, this.state))
      return true;
    if (!PropsHelper.isShallowEqual(nextProps, this.props))
      return true;

    if (this._childRefreshRequired) {
      this._childRefreshRequired = false;
      return true;
    }

    return false;
  }

  private static processGroupItemDef(groupItemDef: GroupItemDef): State {
    // Separate into column items
    const columns = new Map<number, ToolGroupColumn>();
    const numberOfColumns = Math.ceil(groupItemDef.itemCount / groupItemDef.itemsInColumn);
    const numberItemsInColumn = Math.ceil(groupItemDef.itemCount / numberOfColumns);
    let itemIndex: number = 0;

    for (let columnIndex = 0; columnIndex < numberOfColumns; columnIndex++) {
      const columnItems: ColumnItemMap = new Map<string, ToolGroupItem>();
      const columnItemMax = Math.min(groupItemDef.itemCount, itemIndex + numberItemsInColumn);

      for (; itemIndex < columnItemMax; itemIndex++) {
        const item = groupItemDef.getItemByIndex(itemIndex);
        if (item)
          columnItems.set(item.id, item);
      }

      columns.set(columnIndex, { items: columnItems });
    }

    // Separate into trays
    const trays = new Map<string, ToolGroupTray>();
    const trayId = "tray1";
    trays.set(trayId, {
      columns,
      title: groupItemDef.tooltip,
    });

    const state = {
      groupItemDef,
      history: [],
      isExtended: false,
      isPressed: groupItemDef.isPressed,
      isEnabled: groupItemDef.isEnabled,
      isVisible: groupItemDef.isVisible,
      trayId,
      backTrays: [],
      trays,
    };

    return state;
  }

  public static getDerivedStateFromProps(newProps: Props, state: State) {
    if (newProps.groupItemDef !== state.groupItemDef) {
      return GroupItem.processGroupItemDef(newProps.groupItemDef);
    }

    return null;
  }

  private get _tray() {
    const tray = this.state.trays.get(this.state.trayId);
    if (!tray)
      throw new RangeError();

    return tray;
  }

  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const { groupItemDef, ...props } = this.props;
    const icon = <Icon iconSpec={groupItemDef.iconSpec} />;

    return (
      <ExpandableItem
        {...props}
        key={this.state.groupItemDef.id}
        onIsHistoryExtendedChange={(isExtended) => this._handleOnIsHistoryExtendedChange(isExtended)}
        panel={this.getGroupTray()}
        history={this.getHistoryTray()}
      >
        <Item
          isDisabled={!this.state.isEnabled}
          title={this.state.groupItemDef.label}
          onClick={() => this._toggleGroupButton()}
          icon={icon}
        />
      </ExpandableItem>
    );
  }

  private _toggleGroupButton = () => {
    this.setState((_prevState) => ({
      ..._prevState,
      isExtended: false,
      isPressed: !_prevState.isPressed,
    }));
  }

  private _handleOnIsHistoryExtendedChange = (isExtended: boolean) => {
    this.setState((_prevState) => ({ isExtended }));
  }

  private handleToolGroupItemClicked(trayKey: string, columnIndex: number, itemKey: string) {
    this.setState(
      (prevState) => {
        const key = columnIndex + "-" + itemKey;
        const item = { trayKey, columnIndex, itemKey };
        return {
          ...prevState,
          isExpanded: false,
          isPressed: false,
          history: DefaultHistoryManager.addItem(key, item, prevState.history),
        };
      },
      () => {
        const childItem = this.state.groupItemDef.getItemById(itemKey);
        if (childItem && childItem instanceof ActionButtonItemDef)
          childItem.execute();
      },
    );
  }

  private _handleOnHistoryItemClick = (item: HistoryItem) => {
    this.setState(
      (prevState) => {
        return {
          ...prevState,
          isExpanded: false,
          history: DefaultHistoryManager.addItem(item.columnIndex + "-" + item.itemKey, item, prevState.history),
        };
      },
      () => {
        const childItem = this.state.groupItemDef.getItemById(item.itemKey);
        if (childItem && childItem instanceof ActionButtonItemDef)
          childItem.execute();
      },
    );
  }

  private getHistoryTray(): React.ReactNode {
    if (this.state.isPressed)
      return undefined;
    if (this.state.history.length <= 0)
      return undefined;

    return (
      <HistoryTray
        direction={this.state.groupItemDef.direction}
        isExtended={this.state.isExtended}
        items={
          this.state.history.map((entry: HistoryEntry<HistoryItem>) => {
            const tray = this.state.trays.get(entry.item.trayKey)!;
            const column = tray.columns.get(entry.item.columnIndex)!;
            const item = column.items.get(entry.item.itemKey)!;
            const icon = <Icon iconSpec={item.iconSpec} />;

            let isVisible = true;
            let isActive = false;
            let isEnabled = true;

            if (item instanceof ItemDefBase) {
              isVisible = item.isVisible;
              isActive = item.isActive;
              isEnabled = item.isEnabled;
              if (item.stateFunc) {
                const newState = item.stateFunc({ isVisible, isActive, isEnabled });
                isVisible = undefined !== newState.isVisible ? newState.isVisible : isVisible;
                isEnabled = undefined !== newState.isEnabled ? newState.isEnabled : isEnabled;
                isActive = undefined !== newState.isActive ? newState.isActive : isActive;
              }
            }

            return (
              isVisible && <HistoryIcon
                isDisabled={!isEnabled}
                isActive={isActive}
                key={entry.key}
                onClick={() => this._handleOnHistoryItemClick(entry.item)}
                title={item.label}
              >
                {icon}
              </HistoryIcon>
            );
          })
        }
      />
    );
  }

  private getGroupTray(): React.ReactNode {
    if (!this.state.isPressed)
      return undefined;

    const tray = this._tray;
    const columns = (
      Array.from(this._tray.columns.keys()).map((columnIndex) => {
        const column = tray.columns.get(columnIndex)!;
        return (
          <GroupColumn key={columnIndex}>
            {Array.from(column.items.keys()).map((itemKey) => {
              const item = column.items.get(itemKey)!;
              const icon = <Icon iconSpec={item.iconSpec} />;
              let isVisible = true;
              let isActive = false;
              let isEnabled = true;

              if (item instanceof ItemDefBase) {
                isVisible = item.isVisible;
                isActive = item.isActive;
                isEnabled = item.isEnabled;
                if (item.stateFunc) {
                  const newState = item.stateFunc({ isVisible, isActive, isEnabled });
                  isVisible = undefined !== newState.isVisible ? newState.isVisible : isVisible;
                  isEnabled = undefined !== newState.isEnabled ? newState.isEnabled : isEnabled;
                  isActive = undefined !== newState.isActive ? newState.isActive : isActive;
                }
              }

              const trayId = item.trayId;
              if (trayId)
                return (
                  isVisible &&
                  <GroupToolExpander
                    isDisabled={!isEnabled}
                    key={itemKey}
                    ref={itemKey}
                    label={item.label}
                    icon={icon}
                    onClick={() => this.setState((prevState) => {
                      return {
                        ...prevState,
                        trayId,
                        backTrays: [...prevState.backTrays, prevState.trayId],
                      };
                    })}
                  />
                );
              return (
                isVisible &&
                < GroupTool
                  isDisabled={!isEnabled}
                  isActive={isActive}
                  key={itemKey}
                  ref={itemKey}
                  label={item.label}
                  onClick={() => this.handleToolGroupItemClicked(this.state.trayId, columnIndex, itemKey)}
                  icon={icon}
                />
              );
            })}
          </GroupColumn>
        );
      })
    );

    if (this.state.backTrays.length > 0)
      return (
        <NestedToolGroup
          title={tray.title}
          onBack={() => this.setState((prevState) => {
            let trayId = prevState.trayId;
            if (prevState.backTrays.length > 0)
              trayId = prevState.backTrays[prevState.backTrays.length - 1];

            const backTrays = prevState.backTrays.slice(0, -1);
            return {
              ...prevState,
              trayId,
              backTrays,
            };
          })}
          columns={columns}
        />
      );

    return (
      <ToolGroupComponent
        title={tray.title}
        columns={columns}
      />
    );
  }
}

/** Group Button Function component that generates a [[GroupItem]]
 */
// tslint:disable-next-line:variable-name
export const GroupButton: React.FunctionComponent<GroupButtonProps> = (props) => {
  const groupItemDef = new GroupItemDef(props);
  groupItemDef.resolveItems();

  return (
    <GroupItem
      {...props}
      key={groupItemDef.id}
      groupItemDef={groupItemDef}
    />
  );
};

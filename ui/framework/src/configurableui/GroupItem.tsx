/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { ActionButtonItemDef } from "./Item";
import { ItemDefBase } from "./ItemDefBase";
import { GroupItemProps, AnyItemDef } from "./ItemProps";
import { Icon } from "./IconComponent";
import { ItemList, ItemMap } from "./ItemMap";

import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";
import HistoryTray, { History, DefaultHistoryManager, HistoryEntry } from "@bentley/ui-ninezone/lib/toolbar/item/expandable/history/Tray";
import HistoryIcon from "@bentley/ui-ninezone/lib/toolbar/item/expandable/history/Icon";
import ExpandableItem from "@bentley/ui-ninezone/lib/toolbar/item/expandable/Expandable";
import GroupColumn from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/Column";
import ReactGroupTool from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/tool/Tool";
import GroupToolExpander from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/tool/Expander";
import ToolGroupComponent from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/Group";
import NestedToolGroup from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/Nested";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

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

  constructor(groupItemProps: GroupItemProps) {
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

interface State {
  groupItemDef: GroupItemDef;
  trayId: string;
  backTrays: ReadonlyArray<string>;
  trays: Map<string, ToolGroupTray>;
  history: History<HistoryItem>;
  isExtended: boolean;
  isToolGroupOpen: boolean;
}

/** Group Item React component.
 */
class GroupItem extends React.Component<Props, State> {

  /** @hidden */
  public readonly state: Readonly<State>;

  constructor(props: Props, context?: any) {
    super(props, context);

    this.state = GroupItem.processGroupItemDef(this.props.groupItemDef);
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
      isToolGroupOpen: false,
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
    const icon = <Icon iconSpec={this.props.groupItemDef.iconSpec} />;

    return (
      <ExpandableItem
        {...this.props}
        key={this.state.groupItemDef.id}
        onIsHistoryExtendedChange={(isExtended) => this._handleOnIsHistoryExtendedChange(isExtended)}
        panel={this.getGroupTray()}
        history={this.getHistoryTray()}
      >
        <ToolbarIcon
          title={this.state.groupItemDef.label}
          onClick={() => this._toggleIsToolGroupOpen()}
          icon={icon}
        />
      </ExpandableItem>
    );
  }

  private _toggleIsToolGroupOpen = () => {
    this.setState((_prevState) => ({
      ..._prevState,
      isExtended: false,
      isToolGroupOpen: !_prevState.isToolGroupOpen,
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
          isToolGroupOpen: false,
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
    if (this.state.isToolGroupOpen)
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

            return (
              <HistoryIcon
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
    if (!this.state.isToolGroupOpen)
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

              const trayId = item.trayId;
              if (trayId)
                return (
                  <GroupToolExpander
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
                <ReactGroupTool
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

/** Group Button React component state.
 */
export interface GroupItemState {
  groupItemProps: GroupItemProps;
  groupItemDef: GroupItemDef;
}

/** Group Button React component.
 */
export class GroupButton extends React.Component<GroupItemProps, GroupItemState> {

  /** @hidden */
  public readonly state: Readonly<GroupItemState>;

  constructor(props: GroupItemProps, context?: any) {
    super(props, context);

    const groupItemDef = new GroupItemDef(props);
    this.state = { groupItemDef, groupItemProps: props };
  }

  public render(): React.ReactNode {
    if (!this.state.groupItemDef || !this.state.groupItemDef.resolveItems)
      return null;

    this.state.groupItemDef.resolveItems();

    return (
      <GroupItem
        {...this.props}
        key={this.state.groupItemDef.id}
        groupItemDef={this.state.groupItemDef}
      />
    );
  }

  public static getDerivedStateFromProps(newProps: GroupItemProps, state: GroupItemState) {
    if (newProps !== state.groupItemProps) {
      return { groupItemProps: new GroupItemDef(newProps), groupItemDef: newProps };
    }

    return null;
  }
}

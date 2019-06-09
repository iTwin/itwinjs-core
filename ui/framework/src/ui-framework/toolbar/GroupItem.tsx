/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { ItemDefBase, BaseItemState } from "../shared/ItemDefBase";
import { GroupItemProps, AnyItemDef } from "../shared/ItemProps";
import { Icon, IconSpec } from "../shared/IconComponent";
import { ItemList, ItemMap } from "../shared/ItemMap";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { PropsHelper } from "../utils/PropsHelper";

import {
  Item, HistoryTray, History, HistoryIcon, DefaultHistoryManager, HistoryEntry, ExpandableItem, GroupColumn,
  GroupTool, GroupToolExpander, Group as ToolGroupComponent, NestedGroup as NestedToolGroupComponent, Direction, Size,
} from "@bentley/ui-ninezone";
import { withOnOutsideClick, CommonProps } from "@bentley/ui-core";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";
import classnames = require("classnames");

// tslint:disable-next-line: variable-name
const ToolGroup = withOnOutsideClick(ToolGroupComponent, undefined, false);
// tslint:disable-next-line: variable-name
const NestedToolGroup = withOnOutsideClick(NestedToolGroupComponent, undefined, false);

// -----------------------------------------------------------------------------
// GroupItemDef class
// -----------------------------------------------------------------------------

/** An Item that opens a group of items.
 * @public
 */
export class GroupItemDef extends ActionButtonItemDef {
  public groupId: string;
  public direction: Direction;
  public itemsInColumn: number;
  public items: AnyItemDef[];
  public directionExplicit: boolean;

  /** @internal */
  public overflow: boolean = false;

  private _itemList!: ItemList;
  private _itemMap!: ItemMap;

  constructor(groupItemProps: GroupItemProps) {
    super(groupItemProps);

    this.groupId = (groupItemProps.groupId !== undefined) ? groupItemProps.groupId : "";
    this.directionExplicit = (groupItemProps.direction !== undefined);
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

    this.items.map((item: AnyItemDef) => {
      const id: string = item.id;
      this._itemList.addItem(item);
      this._itemMap.set(id, item);
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
    const key = this.getKey(index);
    this.resolveItems();

    return (
      <GroupItem
        key={key}
        groupItemDef={this}
        onSizeKnown={this.handleSizeKnown}
      />
    );
  }

}

// -----------------------------------------------------------------------------
// GroupItem component, props & state
// -----------------------------------------------------------------------------

interface HistoryItem {
  trayKey: string;
  columnIndex: number;
  itemKey: string;
}

interface ToolGroupItem {
  iconSpec?: IconSpec;
  label: string;
  trayId?: string;
}
type ColumnItemMap = Map<string, ToolGroupItem>;

interface ToolGroupColumn {
  items: ColumnItemMap;
}
type ToolGroupColumnMap = Map<number, ToolGroupColumn>;

interface ToolGroupTray {
  title: string;
  columns: ToolGroupColumnMap;
  groupItemDef: GroupItemDef;
}
type ToolGroupTrayMap = Map<string, ToolGroupTray>;

interface GroupItemComponentProps extends CommonProps {
  groupItemDef: GroupItemDef;
  onSizeKnown?: (size: Size) => void;
}

interface GroupItemState extends BaseItemState {
  groupItemDef: GroupItemDef;
  trayId: string;
  backTrays: ReadonlyArray<string>;
  trays: ToolGroupTrayMap;
  history: History<HistoryItem>;
  isExtended: boolean;
}

/** Group Item React component.
 */
class GroupItem extends React.Component<GroupItemComponentProps, GroupItemState> {

  /** @internal */
  public readonly state: Readonly<GroupItemState>;
  private _componentUnmounting = false;
  private _childSyncIds?: Set<string>;
  private _childRefreshRequired = false;
  private _trayIndex = 0;

  constructor(props: GroupItemComponentProps) {
    super(props);

    this._loadChildSyncIds(props);
    this.state = this.getGroupItemState(this.props.groupItemDef);
  }

  private _loadChildSyncIds(props: GroupItemComponentProps) {
    // istanbul ignore else
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
    // istanbul ignore next
    if (this._componentUnmounting) return;

    let refreshState = false;

    // istanbul ignore else
    if (this._childSyncIds && this._childSyncIds.size > 0)
      if ([...this._childSyncIds].some((value: string): boolean => args.eventIds.has(value)))
        this._childRefreshRequired = true;  // this is cleared when render occurs

    let newState: GroupItemState = { ...this.state };

    if (this.props.groupItemDef.stateSyncIds && this.props.groupItemDef.stateSyncIds.length > 0)
      refreshState = this.props.groupItemDef.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));

    if (refreshState || this._childRefreshRequired) {
      if (this.props.groupItemDef.stateFunc)
        newState = this.props.groupItemDef.stateFunc(newState) as GroupItemState;

      // istanbul ignore else
      if ((this.state.isActive !== newState.isActive) || (this.state.isEnabled !== newState.isEnabled) || (this.state.isVisible !== newState.isVisible)
        || this._childRefreshRequired) {
        this.setState({ isActive: newState.isActive, isEnabled: newState.isEnabled, isVisible: newState.isVisible, isPressed: newState.isPressed });
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

  public shouldComponentUpdate(nextProps: GroupItemComponentProps, nextState: GroupItemState) {
    if (!PropsHelper.isShallowEqual(nextState, this.state))
      return true;
    if (!PropsHelper.isShallowEqual(nextProps, this.props))
      return true;

    // istanbul ignore else
    if (this._childRefreshRequired) {
      this._childRefreshRequired = false;
      return true;
    }

    // istanbul ignore next
    return false;
  }

  private getGroupItemState(groupItemDef: GroupItemDef): GroupItemState {
    // Separate into trays
    const trays = new Map<string, ToolGroupTray>();
    const trayId = this.resetTrayId();

    this.processGroupItemDef(groupItemDef, trayId, trays);

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

  private resetTrayId(): string {
    this._trayIndex = 1;
    return `tray-${this._trayIndex}`;
  }

  private generateTrayId(): string {
    return `tray-${this._trayIndex}`;
  }

  private processGroupItemDef(groupItemDef: GroupItemDef, trayId: string, trays: ToolGroupTrayMap): void {
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
        // istanbul ignore else
        if (item) {
          if (item instanceof GroupItemDef) {
            item.resolveItems();

            this._trayIndex++;
            const itemTrayId = this.generateTrayId();
            const groupItem: ToolGroupItem = { iconSpec: item.iconSpec, label: item.label, trayId: itemTrayId };

            columnItems.set(item.id, groupItem);
            this.processGroupItemDef(item, itemTrayId, trays);
          } else {
            columnItems.set(item.id, item);
          }
        }
      }

      columns.set(columnIndex, { items: columnItems });
    }

    trays.set(trayId, {
      columns,
      title: groupItemDef.tooltip,
      groupItemDef,
    });
  }

  public componentDidUpdate(prevProps: GroupItemComponentProps, _prevState: GroupItemState) {
    if (this.props !== prevProps) {
      this.setState(this.getGroupItemState(this.props.groupItemDef));
    }
  }

  private get _tray() {
    const tray = this.state.trays.get(this.state.trayId);
    // istanbul ignore next
    if (!tray)
      throw new RangeError();

    return tray;
  }

  private getTray(trayId: string) {
    const tray = this.state.trays.get(trayId);
    // istanbul ignore next
    if (!tray)
      throw new RangeError();

    return tray;
  }

  private _handleKeyDown = (e: React.KeyboardEvent): void => {
    // istanbul ignore else
    if (e.key === "Escape") {
      this._closeGroupButton();
      KeyboardShortcutManager.setFocusToHome();
    }
  }

  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const { groupItemDef, className, ...props } = this.props;

    const iconSpec: IconSpec = groupItemDef.overflow ? "nz-ellipsis" : groupItemDef.iconSpec;
    const icon = <Icon iconSpec={iconSpec} />;
    const classNames = classnames(
      className,
      groupItemDef.overflow && "nz-toolbar-item-overflow",
    );

    return (
      <ExpandableItem
        {...props}
        className={classNames}
        key={this.state.groupItemDef.id}
        onIsHistoryExtendedChange={(isExtended) => this._handleOnIsHistoryExtendedChange(isExtended)}
        panel={this.getGroupTray()}
        history={this.getHistoryTray()}
      >
        <Item
          className={groupItemDef.overflow ? "nz-ellipsis-icon" : undefined}
          isDisabled={!this.state.isEnabled}
          title={this.state.groupItemDef.label}
          onClick={() => this._toggleGroupButton()}
          onKeyDown={this._handleKeyDown}
          icon={icon}
          onSizeKnown={this.props.onSizeKnown}
        />
      </ExpandableItem>
    );
  }

  private _toggleGroupButton = () => {
    this.setState((prevState) => ({
      ...prevState,
      isExtended: false,
      isPressed: !prevState.isPressed,
    }));
  }

  private _closeGroupButton = () => {
    const trayId = this.resetTrayId();

    this.setState((prevState) => ({
      ...prevState,
      isExtended: false,
      isPressed: false,
      trayId,
      backTrays: [],
    }));
  }

  private _handleOnIsHistoryExtendedChange = (isExtended: boolean) => {
    this.setState({ isExtended });
  }

  private handleToolGroupItemClicked(trayKey: string, columnIndex: number, itemKey: string) {
    this.setState(
      (prevState) => {
        const key = columnIndex + "-" + itemKey;
        const item = { trayKey, columnIndex, itemKey };
        const trayId = this.resetTrayId();
        return {
          ...prevState,
          isExpanded: false,
          isPressed: false,
          history: DefaultHistoryManager.addItem(key, item, prevState.history),
          trayId,
          backTrays: [],
        };
      },
      () => {
        const tray = this.getTray(trayKey);
        const childItem = tray.groupItemDef.getItemById(itemKey);
        // istanbul ignore else
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
        const tray = this.getTray(item.trayKey);
        const childItem = tray.groupItemDef.getItemById(item.itemKey);
        // istanbul ignore else
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

            // istanbul ignore else
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
    const columns = Array.from(this._tray.columns.keys()).map((columnIndex) => {
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
              <GroupTool
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
    });

    if (this.state.backTrays.length > 0)
      return (
        <NestedToolGroup
          columns={columns}
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
          onOutsideClick={this._closeGroupButton}
          title={tray.title}
        />
      );

    return (
      <ToolGroup
        columns={columns}
        onOutsideClick={this._closeGroupButton}
        title={tray.title}
      />
    );
  }
}

/** Properties for the [[GroupButton]] React component
 * @public
 */
export interface GroupButtonProps extends GroupItemProps, CommonProps { }

/** Group Button React component
 * @public
 */
export const GroupButton: React.FunctionComponent<GroupButtonProps> = (props) => {  // tslint:disable-line:variable-name
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

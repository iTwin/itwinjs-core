/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";
import classnames = require("classnames");

import { Logger } from "@bentley/bentleyjs-core";
import { BadgeType, StringGetter, AbstractGroupItemProps, OnItemExecutedFunc } from "@bentley/ui-abstract";
import { withOnOutsideClick, CommonProps, SizeProps, IconSpec, Icon, BadgeUtilities } from "@bentley/ui-core";
import {
  Item, ExpandableItem, GroupColumn, GroupTool, GroupToolExpander, Group as ToolGroupComponent,
  NestedGroup as NestedToolGroupComponent, Direction, withDragInteraction, ToolbarDirectionContext,
} from "@bentley/ui-ninezone";

import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { ItemDefBase, BaseItemState } from "../shared/ItemDefBase";
import { ItemList, ItemMap } from "../shared/ItemMap";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { PropsHelper } from "../utils/PropsHelper";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";
import { UiFramework } from "../UiFramework";
import { AnyItemDef } from "../shared/AnyItemDef";
import { GroupItemProps } from "../shared/GroupItemProps";
import { ItemDefFactory } from "../shared/ItemDefFactory";
import { FrontstageManager, ToolActivatedEventArgs } from "../frontstage/FrontstageManager";
import { ToolGroupPanelContext } from "../frontstage/FrontstageComposer";

// tslint:disable-next-line: variable-name
const ToolGroup = withOnOutsideClick(ToolGroupComponent, undefined, false);
// tslint:disable-next-line: variable-name
const NestedToolGroup = withOnOutsideClick(NestedToolGroupComponent, undefined, false);
// tslint:disable-next-line:variable-name
const ItemWithDragInteraction = withDragInteraction(Item);

// -----------------------------------------------------------------------------
// GroupItemDef class
// -----------------------------------------------------------------------------

/** An Item that opens a group of items.
 * @public
 */
export class GroupItemDef extends ActionButtonItemDef {
  private static _sId = 0;
  public static groupIdPrefix = "Group-";

  public groupId: string;
  public direction: Direction;
  public itemsInColumn: number;
  public items: AnyItemDef[];
  public directionExplicit: boolean;

  /** @internal */
  public overflow: boolean = false;

  private _itemList!: ItemList;
  private _itemMap!: ItemMap;
  private _panelLabel: string | StringGetter = "";

  constructor(groupItemProps: GroupItemProps, onItemExecuted?: OnItemExecutedFunc) {
    super(groupItemProps, onItemExecuted);

    this.groupId = (groupItemProps.groupId !== undefined) ? groupItemProps.groupId : "";
    if (groupItemProps.groupId)
      this.groupId = groupItemProps.groupId;
    else {
      GroupItemDef._sId++;
      this.groupId = GroupItemDef.groupIdPrefix + GroupItemDef._sId;
    }

    this.directionExplicit = (groupItemProps.direction !== undefined);
    this.direction = (groupItemProps.direction !== undefined) ? groupItemProps.direction : Direction.Bottom;
    this.itemsInColumn = (groupItemProps.itemsInColumn !== undefined) ? groupItemProps.itemsInColumn : 7;
    this._panelLabel = PropsHelper.getStringSpec(groupItemProps.panelLabel, groupItemProps.paneLabelKey); // tslint:disable-line: deprecation
    this.items = groupItemProps.items;
  }

  /** @internal */
  public static constructFromAbstractItemProps(itemProps: AbstractGroupItemProps, onItemExecuted?: OnItemExecutedFunc): GroupItemDef {
    const groupItemDef: GroupItemProps = {
      groupId: itemProps.groupId,
      items: ItemDefFactory.createItemListForGroupItem(itemProps.items, onItemExecuted),
      direction: itemProps.direction as number,
      itemsInColumn: itemProps.itemsInColumn,
      panelLabel: itemProps.panelLabel,
      paneLabelKey: itemProps.paneLabelKey,
    };

    return new GroupItemDef(groupItemDef);
  }

  public get id(): string {
    return this.groupId;
  }

  /** Get the panelLabel string */
  public get panelLabel(): string {
    return PropsHelper.getStringFromSpec(this._panelLabel);
  }

  /** Set the panelLabel.
   * @param v A string or a function to get the string.
   */
  public setPanelLabel(v: string | StringGetter) {
    this._panelLabel = v;
  }

  public resolveItems(force?: boolean): void {
    if (this._itemList && !force)
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
    this.resolveItems();
    const key = this.getKey(index);

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

interface ToolGroupItem {
  iconSpec?: IconSpec;
  label: string;
  trayId?: string;
  badgeType?: BadgeType;
}

interface ToolGroupTray {
  title: string;
  items: Map<string, ToolGroupItem>;
  groupItemDef: GroupItemDef;
}
type ToolGroupTrayMap = Map<string, ToolGroupTray>;

interface GroupItemComponentProps extends CommonProps {
  defaultActiveItemId?: string;
  groupItemDef: GroupItemDef;
  onSizeKnown?: (size: SizeProps) => void;
}

interface GroupItemState extends BaseItemState {
  activeItemId: string; // One of group items id.
  activeToolId: string; // FrontstageManager.activeToolId
  groupItemDef: GroupItemDef;
  trayId: string;
  backTrays: ReadonlyArray<string>;
  trays: ToolGroupTrayMap;
}

/** Group Item React component.
 * @internal
 */
export class GroupItem extends React.Component<GroupItemComponentProps, GroupItemState> {
  /** @internal */
  public readonly state: Readonly<GroupItemState>;
  private _componentUnmounting = false;
  private _childSyncIds?: Set<string>;
  private _childRefreshRequired = false;
  private _trayIndex = 0;
  private _closeOnPanelOpened = true;

  constructor(props: GroupItemComponentProps) {
    super(props);

    this._loadChildSyncIds(props);
    this.state = this.getGroupItemState(this.props);
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
    FrontstageManager.onToolActivatedEvent.addListener(this._handleToolActivatedEvent);
    FrontstageManager.onToolPanelOpenedEvent.addListener(this._handleToolPanelOpenedEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
    FrontstageManager.onToolActivatedEvent.removeListener(this._handleToolActivatedEvent);
    FrontstageManager.onToolPanelOpenedEvent.removeListener(this._handleToolPanelOpenedEvent);
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

  private getGroupItemState(props: GroupItemComponentProps): GroupItemState {
    const groupItemDef = props.groupItemDef;
    // Separate into trays
    const trays = new Map<string, ToolGroupTray>();
    const trayId = this.resetTrayId();

    this.processGroupItemDef(groupItemDef, trayId, trays);

    const activeItemId = props.defaultActiveItemId !== undefined ? props.defaultActiveItemId : getFirstItemId(props.groupItemDef);
    const state = {
      activeItemId,
      activeToolId: FrontstageManager.activeToolId,
      groupItemDef,
      isEnabled: groupItemDef.isEnabled,
      isPressed: groupItemDef.isPressed,
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
    const items = new Map<string, ToolGroupItem>();
    for (let itemIndex = 0; itemIndex < groupItemDef.itemCount; itemIndex++) {
      const item = groupItemDef.getItemByIndex(itemIndex)!;
      if (item instanceof GroupItemDef) {
        item.resolveItems();

        this._trayIndex++;
        const itemTrayId = this.generateTrayId();
        const groupItem: ToolGroupItem = {
          iconSpec: item.iconSpec, label: item.label, trayId: itemTrayId,
          badgeType: BadgeUtilities.determineBadgeType(item.badgeType, item.betaBadge), // tslint:disable-line: deprecation
        };

        items.set(item.id, groupItem);
        this.processGroupItemDef(item, itemTrayId, trays);
      } else {
        items.set(item.id, item);
      }
    }

    trays.set(trayId, {
      items,
      title: groupItemDef.panelLabel ? groupItemDef.panelLabel : groupItemDef.tooltip, // we fallback to use tooltip since tooltip was originally (and confusingly) used as a panelLabel
      groupItemDef,
    });
  }

  public componentDidUpdate(prevProps: GroupItemComponentProps, _prevState: GroupItemState) {
    if (this.props !== prevProps) {
      if (this.props.groupItemDef !== prevProps.groupItemDef)
        Logger.logTrace(UiFramework.loggerCategory(this), `Different GroupItemDef for same groupId of ${this.state.groupItemDef.groupId}`);
      this.setState(this.getGroupItemState(this.props));
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
      this.closeGroupButton();
      KeyboardShortcutManager.setFocusToHome();
    }
  }

  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const activeItem = this.getItemById(this.state.activeItemId);
    if (!activeItem)
      return null;

    const { groupItemDef, className, ...props } = this.props;
    const iconSpec: IconSpec = groupItemDef.overflow ? "nz-ellipsis" : activeItem.iconSpec;
    const icon = <Icon iconSpec={iconSpec} />;
    const classNames = classnames(
      className,
      groupItemDef.overflow && "nz-toolbar-item-overflow",
    );
    const badge = BadgeUtilities.getComponentForBadge(groupItemDef.badgeType, groupItemDef.betaBadge);  // tslint:disable-line: deprecation

    return (
      <ToolbarDirectionContext.Consumer>
        {(direction) => (
          <ExpandableItem
            {...props}
            className={classNames}
            key={this.state.groupItemDef.id}
            panel={this.getGroupTray()}
          >
            <ItemWithDragInteraction
              direction={direction}
              className={groupItemDef.overflow ? "nz-ellipsis-icon" : undefined}
              isActive={this.state.activeToolId === this.state.activeItemId}
              isDisabled={!this.state.isEnabled}
              title={groupItemDef.overflow ? groupItemDef.label : activeItem.label}
              onClick={this._handleClick}
              onOpenPanel={this._handleOpenPanel}
              onKeyDown={this._handleKeyDown}
              icon={icon}
              onSizeKnown={this.props.onSizeKnown}
              badge={badge}
            />
          </ExpandableItem>
        )}
      </ToolbarDirectionContext.Consumer>
    );
  }

  private _handleOpenPanel = () => {
    this.setState({
      isPressed: true,
    });
    this._closeOnPanelOpened = false;
    FrontstageManager.onToolPanelOpenedEvent.emit();
    this._closeOnPanelOpened = true;
  }

  private _handleClick = () => {
    const activeItem = this.getItemById(this.state.activeItemId);
    activeItem && activeItem instanceof ActionButtonItemDef && activeItem.execute();
  }

  private _handleOutsideClick = () => {
    this.closeGroupButton();
  }

  private _handleToolActivatedEvent = ({ toolId }: ToolActivatedEventArgs) => {
    this.setState({
      activeToolId: toolId,
    });
  }

  private _handleToolPanelOpenedEvent = () => {
    if (!this._closeOnPanelOpened)
      return;
    this.closeGroupButton();
  }

  private closeGroupButton() {
    const trayId = this.resetTrayId();

    this.setState((prevState) => ({
      ...prevState,
      isPressed: false,
      trayId,
      backTrays: [],
    }));
  }

  private handleToolGroupItemClicked(trayKey: string, itemKey: string) {
    const trayId = this.resetTrayId();
    this.setState({
      activeItemId: itemKey,
      isPressed: false,
      trayId,
      backTrays: [],
    },
      () => {
        const tray = this.getTray(trayKey);
        const childItem = tray.groupItemDef.getItemById(itemKey);
        childItem && childItem instanceof ActionButtonItemDef && childItem.execute();
      },
    );
  }

  private getGroupTray(): React.ReactNode {
    if (!this.state.isPressed)
      return undefined;

    return (
      <ToolGroupPanelContext.Consumer>
        {(activateOnPointerUp) => {
          const tray = this._tray;
          const itemsInColumn = tray.groupItemDef.itemsInColumn;
          const items = [...tray.items.keys()];

          // Divide items equally between columns.
          const numberOfColumns = Math.ceil(items.length / itemsInColumn);
          const numberItemsInColumn = Math.ceil(items.length / numberOfColumns);

          const columnToItems = items.reduce<ReadonlyArray<ReadonlyArray<string>>>((acc, item, index) => {
            const columnIndex = Math.floor(index / numberItemsInColumn);
            if (columnIndex >= acc.length) {
              return [
                ...acc,
                [item],
              ];
            }
            return [
              ...acc.slice(0, columnIndex),
              [
                ...acc[columnIndex],
                item,
              ],
              ...acc.slice(columnIndex + 1),
            ];
          }, []);
          const columns = (columnToItems.map((columnItems, columnIndex) =>
            <GroupColumn key={columnIndex}>
              {columnItems.map((itemKey) => {
                const item = tray.items.get(itemKey)!;
                const icon = <Icon iconSpec={item.iconSpec} />;
                let isVisible = true;
                let isActive = itemKey === this.state.activeToolId;
                let isEnabled = true;
                const badge = BadgeUtilities.getComponentForBadgeType(item.badgeType);

                if (item instanceof ItemDefBase) {
                  isVisible = item.isVisible;
                  isEnabled = item.isEnabled;
                  if (item.stateFunc) {
                    const newState = item.stateFunc({ isVisible, isActive, isEnabled });
                    isVisible = undefined !== newState.isVisible ? newState.isVisible : isVisible;
                    isEnabled = undefined !== newState.isEnabled ? newState.isEnabled : isEnabled;
                    isActive = undefined !== newState.isActive ? newState.isActive : isActive;
                  }
                }

                const trayId = item.trayId;
                if (trayId) {
                  return (
                    isVisible &&
                    <GroupToolExpander
                      isDisabled={!isEnabled}
                      key={itemKey}
                      label={item.label}
                      icon={icon}
                      badge={badge}
                      onClick={() => this._handleExpanderClick(trayId)}
                      onPointerUp={activateOnPointerUp ? () => this._handleExpanderClick(trayId) : undefined}
                    />
                  );
                }

                return (
                  isVisible &&
                  <GroupTool
                    isDisabled={!isEnabled}
                    isActive={isActive}
                    key={itemKey}
                    label={item.label}
                    onClick={() => this.handleToolGroupItemClicked(this.state.trayId, itemKey)}
                    onPointerUp={activateOnPointerUp ? () => this.handleToolGroupItemClicked(this.state.trayId, itemKey) : undefined}
                    icon={icon}
                    badge={badge}
                  />
                );
              })}
            </GroupColumn>,
          ));

          if (this.state.backTrays.length > 0)
            return (
              <NestedToolGroup
                columns={columns}
                onBack={this._handleBack}
                onBackPointerUp={activateOnPointerUp ? this._handleBack : undefined}
                onOutsideClick={this._handleOutsideClick}
                title={tray.title}
              />
            );

          return (
            <ToolGroup
              columns={columns}
              onOutsideClick={this._handleOutsideClick}
              title={tray.title}
            />
          );
        }}
      </ToolGroupPanelContext.Consumer>
    );
  }

  public getItemById(id: string): ItemDefBase | undefined {
    for (const [, tray] of this.state.trays) {
      const item = tray.groupItemDef.getItemById(id);
      if (item)
        return item;
    }
    return undefined;
  }

  private _handleBack = () => {
    this.setState((prevState) => {
      const trayId = prevState.backTrays.length > 0 ? prevState.backTrays[prevState.backTrays.length - 1] : prevState.trayId;
      const backTrays = prevState.backTrays.slice(0, -1);
      return {
        ...prevState,
        trayId,
        backTrays,
      };
    });
  }

  private _handleExpanderClick = (trayId: string) => {
    this.setState((prevState) => {
      return {
        trayId,
        backTrays: [...prevState.backTrays, prevState.trayId],
      };
    });
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

/** @internal */
export const getFirstItem = (groupItemDef: GroupItemDef): AnyItemDef | undefined => {
  for (const item of groupItemDef.items) {
    if (item instanceof GroupItemDef) {
      const firstItem = getFirstItem(item);
      if (firstItem)
        return firstItem;
      continue;
    }
    return item;
  }
  return undefined;
};

/** @internal */
export const getFirstItemId = (groupItemDef: GroupItemDef): string => {
  const item = getFirstItem(groupItemDef);
  return item ? item.id : "";
};

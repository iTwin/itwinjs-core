/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import * as React from "react";
import ReactResizeDetector from "react-resize-detector";

import { Logger } from "@bentley/bentleyjs-core";
import { CommonProps, Orientation, NoChildrenProps, Size } from "@bentley/ui-core";
import { Direction, ToolbarPanelAlignment, Toolbar as NZ_Toolbar } from "@bentley/ui-ninezone";
import { UiFramework } from "../UiFramework";

import { ItemList } from "../shared/ItemMap";
import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { ItemDefBase } from "../shared/ItemDefBase";
import { GroupItemDef } from "./GroupItem";
import { CustomItemDef } from "../shared/CustomItemDef";
import { AnyItemDef } from "../shared/AnyItemDef";

/** Properties of [[Toolbar]] component.
 * @internal
 */
export interface ToolbarProps extends CommonProps, NoChildrenProps {
  /** Items of the toolbar. */
  items: ItemList;
  /** Orientation of the toolbar. */
  orientation: Orientation;
  /** Logging and debugging Id */
  toolbarId?: string;
  /** Describes to which direction the history/panel items are expanded. Defaults to: [[Direction.Bottom]] */
  expandsTo?: Direction;
  /** Describes how expanded panels are aligned. Defaults to: [[ToolbarPanelAlignment.Start]] */
  panelAlignment?: ToolbarPanelAlignment;
  /** initial size */
  initialSize?: Size;
}

/** State of [[Toolbar]] component.
 * @internal
 */
interface State {
  width: number;
  height: number;
  items: React.ReactNode;
}

/** Toolbar React component.
 * @internal
 */
export class Toolbar extends React.Component<ToolbarProps, State> {
  private _dimension: number = 0;
  private _minToolbarSize = (ActionButtonItemDef.defaultButtonSize + 2);

  public constructor(props: ToolbarProps) {
    super(props);

    const itemList = this.props.items;

    // Filter on GroupItemDef
    itemList.forEach((item: ItemDefBase) => {
      if (item instanceof GroupItemDef) {
        // istanbul ignore else
        if (!item.directionExplicit && this.props.expandsTo !== undefined)
          item.direction = this.props.expandsTo;
      }
    });

    // pick a reasonable initial size, when zone layout occurs a resize event will trigger to adjust this size.
    let width = (ActionButtonItemDef.defaultButtonSize + 2) * 3;
    let height = width;

    // istanbul ignore next
    if (props.initialSize) {
      width = props.initialSize.width;
      height = props.initialSize.height;
    }

    const items = this.generateToolbarItems(this.props.items, new Size(width, height));

    // let's set the default size big enough to hold a single button.
    this.state = {
      width,
      height,
      items,
    };
  }

  private get _toolbarId(): string {
    return this.props.toolbarId ? this.props.toolbarId : "unknown";
  }

  public componentDidMount() {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  public componentWillUnmount() {
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
  }

  public componentDidUpdate(prevProps: ToolbarProps, _prevState: State) {
    if (this.props.items !== prevProps.items) {
      // if sync event changed number of displayable buttons layout the toolbar and re-render
      const items = this.generateToolbarItems(this.props.items, new Size(this.state.width, this.state.height));
      this.setState({ items });
    }
  }

  private setCurrentStateValues(item: ItemDefBase): boolean {
    // if a stateFunc is specified call it to get current state values
    // istanbul ignore else
    if (item.stateFunc) {
      const itemState = item.stateFunc({
        isVisible: item.isVisible, isEnabled: item.isEnabled, isPressed: item.isPressed, isActive: item.isActive,
      });
      item.isVisible = !!itemState.isVisible;
      item.isEnabled = !!itemState.isEnabled;
      item.isPressed = !!itemState.isPressed;
      item.isActive = !!itemState.isActive;
      return true;
    }
    return false;
  }

  private _processSyncUiEvent(itemList: ItemList | ItemDefBase[] | AnyItemDef[] | undefined, args: SyncUiEventArgs): boolean {
    // istanbul ignore next
    if (!itemList || 0 === itemList.length)
      return false;

    let returnValue = false;

    // Review all the itemDefs to see if any are monitoring sync events in SyncUiEventArgs
    for (const item of itemList) {
      if (item.stateFunc && item.stateSyncIds && item.stateSyncIds.length > 0 &&
        item.stateSyncIds.some((value: string): boolean => args.eventIds.has(value))) {
        if (item instanceof GroupItemDef) {
          this.setCurrentStateValues(item);
          this._processSyncUiEvent(item.items, args);
        } else {
          this.setCurrentStateValues(item);
        }
        returnValue = true;
      } else {
        if (item instanceof GroupItemDef) {
          if (this._processSyncUiEvent(item.items, args))
            returnValue = true;
        }
      }
    }
    return returnValue;
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if (this._processSyncUiEvent(this.props.items, args)) {
      setImmediate(() => {
        // if sync event changed number of displayable buttons layout the toolbar and re-render
        const items = this.generateToolbarItems(this.props.items, new Size(this.state.width, this.state.height));
        this.setState({ items });
      });
    }
  }

  private layoutToolbarItems(itemList: ItemList): React.ReactNode[] {
    // istanbul ignore next -
    if (0 === itemList.length)
      return [];

    Logger.logInfo(UiFramework.loggerCategory(this), `Available space for toolbar [${this._toolbarId}] = ${this._dimension}`);

    const actionItems = new Array<ActionButtonItemDef>();
    let itemDimensions = 0;

    // Filter on ActionButtonItemDef
    itemList.forEach((item: ItemDefBase) => {
      // istanbul ignore else
      if (item.isVisible) {
        // istanbul ignore else
        if (item instanceof ActionButtonItemDef) {
          actionItems.push(item);
        }
      }
    });

    // Populate the overflow button
    let overflowItemDef: GroupItemDef | undefined;
    if (actionItems.length > 1) {
      // Get the item dimensions
      actionItems.forEach((item: ActionButtonItemDef) => {
        const itemSize = item.getDimension(this.props.orientation) + 1;
        itemDimensions += itemSize;
        Logger.logTrace(UiFramework.loggerCategory(this), `  Item [${item.id ? item.id : item.label}] has a size of ${itemSize} cumulative size=${itemDimensions}.`);
      });

      Logger.logInfo(UiFramework.loggerCategory(this), `  Needed toolbar size [${this._toolbarId}] = ${itemDimensions}`);

      // istanbul ignore next - currently unable to set size in unit test
      const padding = 2;  // used just to insure button will fall inside tool box
      if (itemDimensions > (this._dimension - padding)) {
        const overflowItems: AnyItemDef[] = [];
        const lastItemIndex = actionItems.length - 1;
        let singleItemSize = 0;
        for (let index = lastItemIndex; index >= 0; index--) {
          if (actionItems[index] instanceof CustomItemDef)
            continue;
          if (0 === singleItemSize)
            singleItemSize = actionItems[index].getDimension(this.props.orientation);

          const deletedItems = actionItems.splice(index, 1);
          // istanbul ignore else
          if (deletedItems.length === 1) {
            const item = deletedItems[0];
            overflowItems.unshift(item);
            Logger.logTrace(UiFramework.loggerCategory(this), `  * Item [${item.id ? item.id : item.label}] put into overflow items.`);

            let currentWidth = 0;
            actionItems.forEach((itemDef) => currentWidth += (itemDef.getDimension(this.props.orientation) + 1));
            itemDimensions = (currentWidth + singleItemSize);
            if (itemDimensions < (this._dimension - padding))
              break;
          }
        }

        overflowItemDef = new GroupItemDef({
          groupId: `overflow-group-${itemDimensions}-${actionItems.length}-${overflowItems.length}`,
          labelKey: "UiFramework:general.overflow",
          items: overflowItems,
          direction: this.props.expandsTo,
        });
        overflowItemDef.overflow = true;
      }
    }

    // Populate the toolbar items
    const toolbarItems = actionItems.map((item: ActionButtonItemDef, index: number) => {
      return item.toolbarReactNode(index);
    });

    // istanbul ignore next - currently unsure how to trigger sizing/resizing so overflow is never populated
    if (overflowItemDef)
      toolbarItems.push(overflowItemDef.toolbarReactNode());

    return toolbarItems;
  }

  private generateToolbarItems(itemList: ItemList, size: Size): React.ReactNode {
    this._dimension = (this.props.orientation === Orientation.Horizontal ? size.width : size.height);
    // istanbul ignore next - since sizing is not working in unit test size and dimension always set to default of 42
    if (this._dimension < this._minToolbarSize)
      this._dimension = this._minToolbarSize;

    return this.layoutToolbarItems(itemList);
  }

  // istanbul ignore next - currently unable to replicate resizing in unit test
  private _onResize = (width: number, height: number) => {
    // do allow toolbar to go to a size that doesn't show at least one button;
    if (width < this._minToolbarSize) width = this._minToolbarSize;
    if (height < this._minToolbarSize) height = this._minToolbarSize;
    if (this.state.width !== width || this.state.height !== height) {
      const items = this.generateToolbarItems(this.props.items, new Size(width, height));
      this.setState({ width, height, items });
    }
  }

  private hasVisibleItems(items: ItemList) {
    for (const item of items) {
      // istanbul ignore else
      if (item && item.isVisible)
        return true;
    }
    return false;
  }

  public render() {
    // istanbul ignore next
    if (0 === this.props.items.length || !this.hasVisibleItems(this.props.items)) {
      Logger.logTrace(UiFramework.loggerCategory(this), `--->  nothing to render for ${this._toolbarId} `);
      return null;
    }

    Logger.logTrace(UiFramework.loggerCategory(this), `---> render ${this._toolbarId} `);

    return (
      <>
        <ReactResizeDetector handleWidth handleHeight onResize={this._onResize} />
        <NZ_Toolbar
          expandsTo={this.props.expandsTo}
          panelAlignment={this.props.panelAlignment}
          items={
            <>
              {this.state.items}
            </>
          }
        />
      </>
    );
  }
}

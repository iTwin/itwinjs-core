/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";
import ReactResizeDetector from "react-resize-detector";

import { Logger } from "@bentley/bentleyjs-core";
import { CommonProps, Orientation, NoChildrenProps } from "@bentley/ui-core";
import { Direction, Size, ToolbarPanelAlignment, Toolbar as NZ_Toolbar } from "@bentley/ui-ninezone";
import { UiFramework } from "../UiFramework";

import { ItemList } from "../shared/ItemMap";
import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { ItemDefBase } from "../shared/ItemDefBase";
import { GroupItemDef } from "./GroupItem";
import { AnyItemDef } from "../shared/ItemProps";
import { ConditionalItemDef } from "../shared/ConditionalItemDef";
import { CustomItemDef } from "../shared/CustomItemDef";

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
}

/** State of [[Toolbar]] component.
 * @internal
 */
interface State {
  width: number;
  height: number;
}

/** Toolbar React component.
 * @internal
 */
export class Toolbar extends React.Component<ToolbarProps, State> {
  private _dimension: number = 0;
  private _checkForOverflow = true;
  private _reRenderRequired = false;  // this is set to true if an item does not yet have a defined size.

  public constructor(props: ToolbarProps) {
    super(props);

    // let's set the default size big enough to hold a single button.
    this.state = {
      width: 42,
      height: 42,
    };

    const itemList = this.props.items;

    // Filter on GroupItemDef
    itemList.forEach((item: ItemDefBase) => {
      if (item instanceof GroupItemDef) {
        // istanbul ignore else
        if (!item.directionExplicit && this.props.expandsTo !== undefined)
          item.direction = this.props.expandsTo;
      }
    });
  }

  private get _toolbarId(): string {
    return this.props.toolbarId ? this.props.toolbarId : "unknown";
  }

  public componentDidMount() {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
    window.addEventListener("resize", this._handleWindowResize, true);
  }

  public componentWillUnmount() {
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
    window.removeEventListener("resize", this._handleWindowResize, true);
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
        if (item instanceof ConditionalItemDef) {
          item.handleSyncUiEvent(args);
        } else if (item instanceof GroupItemDef) {
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
    if (this._processSyncUiEvent(this.props.items, args))
      this.forceUpdate();
  }

  // istanbul ignore next - currently unsure how to trigger sizing/resizing
  private _handleWindowResize = () => {
    this._checkForOverflow = !this._toolbarId.includes("vertical");  // only set to false for vertical toolbars horizontal properly determine their size.
    this.forceUpdate();
  }

  private renderToolbarItems(itemList: ItemList, checkForOverflow: boolean): React.ReactNode[] {
    // istanbul ignore next -
    if (0 === itemList.length)
      return [];

    Logger.logInfo(UiFramework.loggerCategory(this), `Available space for toolbar [${this._toolbarId}] = ${this._dimension}`);

    const actionItems = new Array<ActionButtonItemDef>();
    let itemDimensions = 0;

    // Filter on ActionButtonItemDef
    itemList.forEach((item: ItemDefBase) => {
      if (item.isVisible) {
        if (item instanceof ActionButtonItemDef) {
          actionItems.push(item);
        } else {
          // istanbul ignore else
          if (item instanceof ConditionalItemDef) {
            const visibleItems = item.getVisibleItems();
            visibleItems.forEach((childItem: ActionButtonItemDef) => {
              actionItems.push(childItem);
            });
          }
        }
      }
    });

    // Populate the overflow button
    let overflowItemDef: GroupItemDef | undefined;
    if (actionItems.length > 1 && checkForOverflow) {
      // Get the item dimensions
      actionItems.forEach((item: ActionButtonItemDef) => {
        if (!item.size) {
          Logger.logTrace(UiFramework.loggerCategory(this), `  Item [${item.id}] does not have an assigned size, setting re-render flag.}`);
          this._reRenderRequired = true;
        } else {
          const itemSize = item.getDimension(this.props.orientation) + 1;
          itemDimensions += itemSize;
          Logger.logTrace(UiFramework.loggerCategory(this), `  Item [${item.id}] has a size of ${itemSize} cumulative size=${itemDimensions}.}`);
        }
      });

      Logger.logInfo(UiFramework.loggerCategory(this), `  Needed toolbar size [${this._toolbarId}] = ${itemDimensions}`);

      // istanbul ignore next - currently unable to set size in unit test
      if (itemDimensions > this._dimension) {
        const overflowItems: AnyItemDef[] = [];
        const lastItemIndex = actionItems.length - 1;
        let numItemsInOverflow = 0;

        for (let index = lastItemIndex; index >= 0; index--) {
          if (actionItems[index] instanceof CustomItemDef)
            continue;

          const deletedItems = actionItems.splice(index, 1);
          // istanbul ignore else
          if (deletedItems.length === 1) {
            const item = deletedItems[0];
            overflowItems.unshift(item);
            numItemsInOverflow += 1;

            if (1 !== numItemsInOverflow)  // size doesn't change for initial item in overflow
              itemDimensions -= item.getDimension(this.props.orientation) + 1;

            if (itemDimensions <= this._dimension)
              break;
          }
        }

        overflowItemDef = new GroupItemDef({
          groupId: "overflow-group",
          labelKey: "UiFramework:general.overflow",
          items: overflowItems,
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
    if (this._dimension < 42)
      this._dimension = 42;

    const items = this.renderToolbarItems(itemList, this._checkForOverflow);
    this._checkForOverflow = true;
    return items;
  }

  // istanbul ignore next - currently unable to replicate resizing in unit test
  private _onResize = (width: number, height: number) => {
    // do allow toolbar to go to a size that doesn't show at least one button;
    if (width < 42) width = 42;
    if (height < 42) height = 42;
    if (this.state.width !== width || this.state.height !== height) {
      this.setState({ width, height });
    }
  }

  public render() {
    // istanbul ignore next
    if (0 === this.props.items.length) {
      Logger.logTrace(UiFramework.loggerCategory(this), `--->  nothing to render for ${this._toolbarId} `);
      return null;
    }

    Logger.logTrace(UiFramework.loggerCategory(this), `---> render ${this._toolbarId} `);
    const { width, height } = this.state;
    const items = this.generateToolbarItems(this.props.items, new Size(width, height));

    return (
      <>
        <ReactResizeDetector handleWidth handleHeight onResize={this._onResize} />
        <NZ_Toolbar
          expandsTo={this.props.expandsTo}
          panelAlignment={this.props.panelAlignment}
          items={
            <>
              {items}
            </>
          }
        />
      </>
    );
  }

  public componentDidUpdate() {
    Logger.logTrace(UiFramework.loggerCategory(this), `---> componentDidUpdate ${this._toolbarId}`);

    // _reRenderRequired will only be true if we encounter an toolbar item that does not have a size defined.
    // We must wait for one render pass so that the size is set.
    if (this._reRenderRequired) {
      Logger.logTrace(UiFramework.loggerCategory(this), `        Triggering re-render of ${this._toolbarId} because one or more items did not have an assigned size.}`);
      this._reRenderRequired = false;
      this.forceUpdate();
    }
  }
}

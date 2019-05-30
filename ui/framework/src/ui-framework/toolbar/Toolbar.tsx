/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";
import ReactResizeDetector from "react-resize-detector";

import { CommonProps, Orientation } from "@bentley/ui-core";
import {
  NoChildrenProps,
  Direction,
  ToolbarPanelAlignment,
  Toolbar as NZ_Toolbar,
  Size,
} from "@bentley/ui-ninezone";

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

  /** Describes to which direction the history/panel items are expanded. Defaults to: [[Direction.Bottom]] */
  expandsTo?: Direction;
  /** Describes how expanded panels are aligned. Defaults to: [[ToolbarPanelAlignment.Start]] */
  panelAlignment?: ToolbarPanelAlignment;
}

/** Toolbar React component.
 * @internal
 */
export class Toolbar extends React.Component<ToolbarProps> {
  private _mounted = false;
  private _dimension: number = 0;
  private _checkForOverflow = true;

  public constructor(props: ToolbarProps) {
    super(props);

    const itemList = this.props.items;

    // Filter on GroupItemDef
    itemList.forEach((item: ItemDefBase) => {
      if (item instanceof GroupItemDef) {
        if (!item.directionExplicit && this.props.expandsTo !== undefined)
          item.direction = this.props.expandsTo;
      }
    });
  }

  public componentDidMount() {
    this._mounted = true;
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
    window.addEventListener("resize", this._handleWindowResize, true);
  }

  public componentWillUnmount() {
    this._mounted = false;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
    window.removeEventListener("resize", this._handleWindowResize, true);
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    // istanbul ignore next
    if (!this._mounted)
      return;

    const itemList = this.props.items;
    let toolbarRefresh = false;

    // Filter on ConditionalItemDef
    itemList.forEach((item: ItemDefBase) => {
      if (item instanceof ConditionalItemDef) {
        const itemRefresh = item.handleSyncUiEvent(args);
        if (itemRefresh && !toolbarRefresh)
          toolbarRefresh = itemRefresh;
      }
    });

    if (toolbarRefresh)
      this.forceUpdate();
  }

  private _handleWindowResize = () => {
    this._checkForOverflow = false;
    this.forceUpdate();
  }

  private renderToolbarItems(itemList: ItemList, checkForOverflow: boolean): React.ReactNode[] {
    const actionItems = new Array<ActionButtonItemDef>();
    let itemDimensions = 0;

    // Filter on ActionButtonItemDef
    itemList.forEach((item: ItemDefBase) => {
      if (item instanceof ActionButtonItemDef && item.isVisible) {
        actionItems.push(item);
      } else if (item instanceof ConditionalItemDef) {
        const visibleItems = item.getVisibleItems();
        visibleItems.forEach((childItem: ActionButtonItemDef) => {
          actionItems.push(childItem);
        });
      }
    });

    // Get the item dimensions
    actionItems.forEach((item: ActionButtonItemDef) => {
      // istanbul ignore else
      if (item.size) {
        itemDimensions += item.getDimension(this.props.orientation);
      }
    });

    // Populate the overflow button
    let overflowItemDef: GroupItemDef | undefined;
    if (checkForOverflow) {
      if (itemDimensions > this._dimension) {
        const overflowItems: AnyItemDef[] = [];
        const lastItemIndex = actionItems.length - 1;

        for (let index = lastItemIndex; index >= 0; index--) {
          if (actionItems[index] instanceof CustomItemDef)
            continue;

          const deletedItems = actionItems.splice(index, 1);
          // istanbul ignore else
          if (deletedItems.length === 1) {
            const item = deletedItems[0];
            overflowItems.unshift(item);

            if (index !== lastItemIndex && item.size)
              itemDimensions -= item.getDimension(this.props.orientation);

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

    if (overflowItemDef)
      toolbarItems.push(overflowItemDef.toolbarReactNode());

    return toolbarItems;
  }

  private generateToolbarItems(itemList: ItemList, size: Size): React.ReactNode {
    this._dimension = (this.props.orientation === Orientation.Horizontal ? size.width : size.height) - 1;

    const items = this.renderToolbarItems(itemList, this._checkForOverflow);
    this._checkForOverflow = true;
    return items;
  }

  public render() {

    return (
      <ReactResizeDetector handleWidth handleHeight >
        {(width: number, height: number) =>
          <NZ_Toolbar
            expandsTo={this.props.expandsTo}
            panelAlignment={this.props.panelAlignment}
            items={
              <>
                {this.generateToolbarItems(this.props.items, new Size(width, height))}
              </>
            }
          />
        }
      </ReactResizeDetector>
    );
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { WidgetDef, ToolbarWidgetProps } from "./WidgetDef";
import { CommandItemDef } from "../shared/CommandItemDef";
import { ItemList } from "../shared/ItemMap";

import { Direction, ToolbarPanelAlignment } from "@bentley/ui-ninezone";
import { Toolbar } from "../toolbar/Toolbar";
import { Orientation } from "@bentley/ui-core";
import { PluginUiManager, UiItemNode, ActionItemInsertSpec, ToolInsertSpec, ToolbarItemInsertSpec, IModelApp } from "@bentley/imodeljs-frontend";
import { ItemDefBase } from "../shared/ItemDefBase";
import { AnyItemDef } from "../shared/ItemProps";
import { GroupItemDef } from "../toolbar/GroupItem";
import { ConditionalItemDef } from "../shared/ConditionalItemDef";
// import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";

/** A Toolbar Widget normally displayed in the top left & top right zones in the 9-Zone Layout system.
 * @public
 */
export class ToolbarWidgetDefBase extends WidgetDef {
  public horizontalDirection: Direction;
  public verticalDirection: Direction;

  public horizontalPanelAlignment: ToolbarPanelAlignment;
  public verticalPanelAlignment: ToolbarPanelAlignment;

  public horizontalItems?: ItemList;
  public verticalItems?: ItemList;

  constructor(def: ToolbarWidgetProps) {
    super(def);

    this.horizontalDirection = (def.horizontalDirection !== undefined) ? def.horizontalDirection : Direction.Bottom;
    this.verticalDirection = (def.verticalDirection !== undefined) ? def.verticalDirection : Direction.Right;

    this.horizontalPanelAlignment = ToolbarPanelAlignment.Start;
    this.verticalPanelAlignment = ToolbarPanelAlignment.Start;

    this.horizontalItems = def.horizontalItems;
    this.verticalItems = def.verticalItems;
  }

  private createItemDefFromInsertSpec(spec: ToolbarItemInsertSpec): ItemDefBase | undefined {
    // istanbul ignore else
    if (spec.isActionItem) {
      const actionSpec = spec as ActionItemInsertSpec;
      return new CommandItemDef({
        commandId: actionSpec.itemId,
        iconSpec: actionSpec.icon,
        label: actionSpec.label,
        execute: actionSpec.execute,
      });
    } else {
      const toolSpec = spec as ToolInsertSpec;
      return new CommandItemDef({
        commandId: toolSpec.toolId,
        iconSpec: toolSpec.icon,
        label: toolSpec.label,
        execute: () => { IModelApp.tools.run(toolSpec.toolId); },
      });
    }

    return undefined;
  }

  private insertItemDefAtLocation(item: ItemDefBase, itemList: ItemList | ItemDefBase[], relativePath: string[], insertBefore: boolean): void {
    // istanbul ignore else
    if (0 === relativePath.length) {
      if (insertBefore)
        itemList.splice(0, 0, item);
      else
        itemList.push(item);
      return;
    }

    const pathToFind = relativePath[0].toLowerCase();
    let foundIndex = itemList.findIndex((itemDef: ItemDefBase) => {
      const id = itemDef.id ? itemDef.id : "none";
      return (id.toLowerCase() === pathToFind);
    });
    if (foundIndex >= 0 && relativePath.length > 1) {
      const parentItem = itemList[foundIndex];
      if (parentItem instanceof GroupItemDef)
        return this.insertItemDefAtLocation(item, parentItem.items, relativePath.slice(1), insertBefore);
      else if (parentItem instanceof ConditionalItemDef)
        return this.insertItemDefAtLocation(item, parentItem.items, relativePath.slice(1), insertBefore);
    }

    if (!insertBefore)
      foundIndex += 1;

    // istanbul ignore else
    if (foundIndex <= 0)
      foundIndex = 0;

    if (foundIndex < itemList.length)
      itemList.splice(foundIndex, 0, item);
    else
      itemList.push(item);
    return;
  }

  // ?????? TODO - extend AnyItemDef to include ConditionalItemDef (this would break backwards compatibility)
  /** Ensure all containers are duplicated so new items can be inserted while preserving the original Groups */
  private mergeItems(originalItems: AnyItemDef[]): AnyItemDef[] {
    const mergedItemList: AnyItemDef[] = [];

    originalItems.forEach((item: AnyItemDef) => {
      if (item instanceof GroupItemDef) {
        mergedItemList.push(this.copyGroupItemDef(item));
      } else {
        mergedItemList.push(item);
      }
    });
    return mergedItemList;
  }

  private copyConditionalItemDef(originalItem: ConditionalItemDef): ConditionalItemDef {
    // Istanbul ignore next
    let newConditionalItemDef = new ConditionalItemDef({ conditionalId: originalItem.id, items: [] });
    // copy data from original object
    newConditionalItemDef = Object.assign(newConditionalItemDef, originalItem);
    // generate new list of child items
    newConditionalItemDef.items = this.mergeItems(originalItem.items);
    return newConditionalItemDef;
  }

  private copyGroupItemDef(originalGroup: GroupItemDef): GroupItemDef {
    // Istanbul ignore next
    let newGroupItemDef = new GroupItemDef({ groupId: originalGroup.id, items: [], direction: originalGroup.direction, itemsInColumn: originalGroup.itemsInColumn });
    // copy data from original object
    newGroupItemDef = Object.assign(newGroupItemDef, originalGroup);
    // generate new list of child items
    newGroupItemDef.items = this.mergeItems(originalGroup.items);
    return newGroupItemDef;
  }

  /** Create a Merged ItemList leaving the original ItemList untouched. */
  // Istanbul ignore next
  private createMergedItemList(originalItemList: ItemList | undefined, insertSpecs: ToolbarItemInsertSpec[]) {
    // initially just copy original list and add new items to it.
    const mergedItemList = new ItemList();
    // istanbul ignore else
    if (originalItemList) {
      originalItemList.items.forEach((item: ItemDefBase) => {
        if (item instanceof ConditionalItemDef) {
          mergedItemList.addItem(this.copyConditionalItemDef(item));
        } else if (item instanceof GroupItemDef) {
          mergedItemList.addItem(this.copyGroupItemDef(item));
        } else {
          mergedItemList.addItem(item);
        }
      });
    }

    insertSpecs.forEach((spec: ToolbarItemInsertSpec) => {
      const itemToInsert = this.createItemDefFromInsertSpec(spec);
      // istanbul ignore else
      if (itemToInsert) {
        this.insertItemDefAtLocation(itemToInsert, mergedItemList, spec.relativeToolIdPath ? spec.relativeToolIdPath.split("\\") : [], !!spec.insertBefore);
      }
    });
    return mergedItemList;
  }

  /** Build item hierarchy that will be passed to Plugins so they can add their UI button into toolboxes supported in ninezone widgets  */
  private getItemHierarchy(parentNode: UiItemNode, items: ItemDefBase[]): void {
    items.forEach((item: ItemDefBase) => {
      const childNode = new UiItemNode(item.id);
      parentNode.children.push(childNode);

      // istanbul ignore next
      if (item instanceof ConditionalItemDef) {
        this.getItemHierarchy(childNode, item.items);
      } else if (item instanceof GroupItemDef) {
        this.getItemHierarchy(childNode, item.items);
      }
    });
  }

  public renderHorizontalToolbar = (toolbarId: string): React.ReactNode | null => {
    let toolbarItems = this.horizontalItems;
    const toolbarHierarchy = new UiItemNode();
    if (this.horizontalItems)
      this.getItemHierarchy(toolbarHierarchy, this.horizontalItems.items);

    const insertSpecs = PluginUiManager.getToolbarItems(toolbarId, toolbarHierarchy);
    if (insertSpecs && insertSpecs.length > 0) {
      toolbarItems = this.createMergedItemList(this.horizontalItems, insertSpecs);
    }

    if (toolbarItems && toolbarItems.items.length) {
      return (
        <Toolbar
          orientation={Orientation.Horizontal}
          expandsTo={this.horizontalDirection}
          panelAlignment={this.horizontalPanelAlignment}
          items={toolbarItems}
        />
      );
    }

    return null;
  }

  public renderVerticalToolbar = (toolbarId: string): React.ReactNode | null => {
    let toolbarItems = this.verticalItems;
    const toolbarHierarchy = new UiItemNode();
    if (this.verticalItems)
      this.getItemHierarchy(toolbarHierarchy, this.verticalItems.items);

    const insertSpecs = PluginUiManager.getToolbarItems(toolbarId, toolbarHierarchy);
    if (insertSpecs && insertSpecs.length > 0) {
      toolbarItems = this.createMergedItemList(this.verticalItems, insertSpecs);
    }

    if (toolbarItems && toolbarItems.items.length) {
      return (
        <Toolbar
          orientation={Orientation.Vertical}
          expandsTo={this.verticalDirection}
          panelAlignment={this.verticalPanelAlignment}
          items={toolbarItems}
        />
      );
    }

    return null;
  }
}

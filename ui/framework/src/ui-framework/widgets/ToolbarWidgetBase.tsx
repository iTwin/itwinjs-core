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
import {
  PluginUiManager, UiItemNode, ActionItemInsertSpec, GroupItemInsertSpec, ToolbarItemInsertSpec,
  ToolbarItemType, BadgeType, ConditionalDisplayType,
} from "@bentley/imodeljs-frontend";
import { ItemDefBase, BaseItemState } from "../shared/ItemDefBase";
import { AnyItemDef } from "../shared/ItemProps";
import { GroupItemDef } from "../toolbar/GroupItem";
import { ConditionalItemDef } from "../shared/ConditionalItemDef";

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
  protected _cachedHorizontalItems?: ItemList;
  protected _cachedVerticalItems?: ItemList;
  private _toolbarBaseName = "";

  constructor(def: ToolbarWidgetProps) {
    super(def);

    this.horizontalDirection = (def.horizontalDirection !== undefined) ? def.horizontalDirection : Direction.Bottom;
    this.verticalDirection = (def.verticalDirection !== undefined) ? def.verticalDirection : Direction.Right;

    this.horizontalPanelAlignment = ToolbarPanelAlignment.Start;
    this.verticalPanelAlignment = ToolbarPanelAlignment.Start;

    this.horizontalItems = def.horizontalItems;
    this.verticalItems = def.verticalItems;
  }

  public set widgetBaseName(baseName: string) {
    this._toolbarBaseName = baseName;
  }
  public get widgetBaseName() {
    return this._toolbarBaseName;
  }

  private createItemDefFromInsertSpec(spec: ToolbarItemInsertSpec): ItemDefBase | undefined {
    let itemDef: ItemDefBase | undefined;

    // istanbul ignore else
    if (ToolbarItemType.ActionButton === spec.itemType) {
      const actionSpec = spec as ActionItemInsertSpec;
      itemDef = new CommandItemDef({
        commandId: actionSpec.itemId,
        iconSpec: actionSpec.icon,
        label: actionSpec.label,
        execute: actionSpec.execute,
        betaBadge: actionSpec.badge ? actionSpec.badge === BadgeType.TechnicalPreview : false,
      });
    } else if (ToolbarItemType.GroupButton === spec.itemType) {
      const groupSpec = spec as GroupItemInsertSpec;
      const childItems: AnyItemDef[] = [];
      groupSpec.items.forEach((childSpec: ToolbarItemInsertSpec) => {
        const childItem = this.createItemDefFromInsertSpec(childSpec) as AnyItemDef;
        if (childItem)
          childItems.push(childItem);
      });
      itemDef = new GroupItemDef({
        groupId: groupSpec.itemId,
        iconSpec: groupSpec.icon,
        label: groupSpec.label,
        betaBadge: groupSpec.badge ? groupSpec.badge === BadgeType.TechnicalPreview : false,
        items: childItems,
      });
    }

    // If conditional display options are defined set up item def with necessary stateFunc and stateSyncIds
    // istanbul ignore else
    if (itemDef) {
      // istanbul ignore else
      if (spec.condition && spec.condition.testFunc && spec.condition.syncEventIds.length > 0) {
        if (spec.condition.type === ConditionalDisplayType.Visibility) {
          itemDef.stateFunc = (state: Readonly<BaseItemState>): BaseItemState => {
            return spec.condition!.testFunc() ? { ...state, isVisible: true } : { ...state, isVisible: false };
          };
        } else {
          itemDef.stateFunc = (state: Readonly<BaseItemState>): BaseItemState => {
            return spec.condition!.testFunc() ? { ...state, isEnabled: true } : { ...state, isEnabled: false };
          };
        }
        itemDef.stateSyncIds = spec.condition.syncEventIds;
      }
    }

    return itemDef;
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
      if ((parentItem instanceof GroupItemDef) || (parentItem instanceof ConditionalItemDef)) {
        this.insertItemDefAtLocation(item, parentItem.items, relativePath.slice(1), insertBefore);
        parentItem.resolveItems(true);
        return;
      }
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
    newConditionalItemDef.resolveItems(true);
    return newConditionalItemDef;
  }

  private copyGroupItemDef(originalGroup: GroupItemDef): GroupItemDef {
    // Istanbul ignore next
    let newGroupItemDef = new GroupItemDef({ groupId: originalGroup.id, items: [], direction: originalGroup.direction, itemsInColumn: originalGroup.itemsInColumn });
    // copy data from original object
    newGroupItemDef = Object.assign(newGroupItemDef, originalGroup);
    // generate new list of child items
    newGroupItemDef.items = this.mergeItems(originalGroup.items);
    newGroupItemDef.resolveItems(true);
    return newGroupItemDef;
  }

  /** Create a Merged ItemList leaving the original ItemList untouched. */
  // Istanbul ignore next
  protected createMergedItemList(originalItemList: ItemList | undefined, insertSpecs: ToolbarItemInsertSpec[]) {
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

  protected createCachedHorizontalItemList(toolbarId: string): void {
    const toolbarHierarchy = new UiItemNode();
    // istanbul ignore else
    if (this.horizontalItems)
      this.getItemHierarchy(toolbarHierarchy, this.horizontalItems.items);

    const insertSpecs = PluginUiManager.getToolbarItems(toolbarId, toolbarHierarchy);
    // istanbul ignore else
    if (insertSpecs && insertSpecs.length > 0) {
      this._cachedHorizontalItems = this.createMergedItemList(this.horizontalItems, insertSpecs);
    }
  }

  protected createCachedVerticalItemList(toolbarId: string): void {
    const toolbarHierarchy = new UiItemNode();
    // istanbul ignore else
    if (this, this.verticalItems)
      this.getItemHierarchy(toolbarHierarchy, this.verticalItems.items);

    const insertSpecs = PluginUiManager.getToolbarItems(toolbarId, toolbarHierarchy);
    // istanbul ignore else
    if (insertSpecs && insertSpecs.length > 0) {
      this._cachedVerticalItems = this.createMergedItemList(this.verticalItems, insertSpecs);
    }
  }

  public generateMergedItemLists(): void {
    this._cachedHorizontalItems = undefined;
    this._cachedVerticalItems = undefined;

    // istanbul ignore else
    if (PluginUiManager.hasRegisteredProviders) {
      this.createCachedHorizontalItemList(`${this.widgetBaseName}-horizontal`);
      this.createCachedVerticalItemList(`${this.widgetBaseName}-vertical`);
    }
  }

  /** Build item hierarchy that will be passed to Plugins so they can add their UI button into toolboxes supported in ninezone widgets  */
  protected getItemHierarchy(parentNode: UiItemNode, items: ItemDefBase[]): void {
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

  public renderHorizontalToolbar(): React.ReactNode {
    const toolbarItems = this._cachedHorizontalItems ? this._cachedHorizontalItems : this.horizontalItems;
    if (toolbarItems && toolbarItems.items.length) {
      return (
        <Toolbar
          toolbarId={`${this.widgetBaseName}-horizontal`}
          orientation={Orientation.Horizontal}
          expandsTo={this.horizontalDirection}
          panelAlignment={this.horizontalPanelAlignment}
          items={toolbarItems}
        />
      );
    }

    return null;
  }

  public renderVerticalToolbar(): React.ReactNode {
    const toolbarItems = this._cachedVerticalItems ? this._cachedVerticalItems : this.verticalItems;
    if (toolbarItems && toolbarItems.items.length) {
      return (
        <Toolbar
          toolbarId={`${this.widgetBaseName}-vertical`}
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { AnyItemProps, AnyToolbarItemProps, OnItemExecutedFunc } from "@bentley/ui-abstract";

import { ToolItemDef } from "./ToolItemDef";
import { CommandItemDef } from "./CommandItemDef";
import { GroupItemDef } from "../toolbar/GroupItem";
import { AnyItemDef } from "./AnyItemDef";
import { ConditionalItemDef } from "./ConditionalItemDef";
import { AnyToolbarItemDef } from "./AnyToolbarItemDef";
import { ItemList } from "./ItemMap";

/** Factory class for creating an appropriate Item definition based on Item properties.
 * @internal
 */
export class ItemDefFactory {
  /** Creates an appropriate [[AnyItemDef]] based on the given [[ItemProps]].
   * @param itemProps  The properties used to create the ItemDefBase
   * @returns  The created ItemDefBase
   */
  public static createForGroupItem(itemProps: AnyItemProps, onItemExecuted?: OnItemExecutedFunc): AnyItemDef | undefined {
    let itemDef: AnyItemDef | undefined;

    if ("toolId" in itemProps) {
      itemDef = new ToolItemDef(itemProps, onItemExecuted);
    } else if ("commandId" in itemProps || "execute" in itemProps) {
      itemDef = new CommandItemDef(itemProps, onItemExecuted);
    } else if ("groupId" in itemProps) {
      itemDef = GroupItemDef.constructFromAbstractItemProps(itemProps, onItemExecuted);
    }

    return itemDef;
  }

  /** Creates an appropriate [[AnyItemDef]] based on the given [[ItemProps]].
   * @param itemProps  The properties used to create the ItemDefBase
   * @returns  The created ItemDefBase
   */
  public static createForToolbar(itemProps: AnyToolbarItemProps, onItemExecuted?: OnItemExecutedFunc): AnyToolbarItemDef | undefined {
    let itemDef: AnyToolbarItemDef | undefined = ItemDefFactory.createForGroupItem(itemProps as AnyItemProps, onItemExecuted);

    if (itemDef === undefined) {
      // istanbul ignore else
      if ("conditionalId" in itemProps) {
        itemDef = ConditionalItemDef.constructFromAbstractItemProps(itemProps, onItemExecuted);
      }
    }

    return itemDef;
  }

  /** Creates an appropriate [[ItemDefBase]] array based on the given array of [[AnyItemProps]].
   * @param itemPropsList  The array of properties used to create the ItemDefBase
   * @returns  The created array of ItemDefBase
   */
  public static createItemListForGroupItem(itemPropsList: AnyItemProps[], onItemExecuted?: OnItemExecutedFunc): AnyItemDef[] {
    const itemDefs = new Array<AnyItemDef>();

    for (const itemProps of itemPropsList) {
      const itemDef = ItemDefFactory.createForGroupItem(itemProps, onItemExecuted);
      // istanbul ignore else
      if (itemDef)
        itemDefs.push(itemDef);
    }

    return itemDefs;
  }

  /** Creates an [[ItemList]] based on the given array of [[AnyItemProps]].
   * @param itemPropsList  The array of properties used to create the ItemDefBase
   * @returns  The created array of ItemDefBase
   */
  public static createItemListForToolbar(itemPropsList: AnyToolbarItemProps[], onItemExecuted?: OnItemExecutedFunc): ItemList {
    const itemDefs = new ItemList();

    for (const itemProps of itemPropsList) {
      const itemDef = ItemDefFactory.createForToolbar(itemProps, onItemExecuted);
      // istanbul ignore else
      if (itemDef)
        itemDefs.push(itemDef);
    }

    return itemDefs;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type UnitSystemDifference } from "../Differencing/SchemaDifference";
import { type SchemaMergerHandler } from "./SchemaItemMerger";

/**
 * @internal
 */
export const unitSystemMerger: SchemaMergerHandler<UnitSystemDifference> = {
  async add(context, change) {
    return context.editor.unitSystems.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.difference,
    });
  },
};

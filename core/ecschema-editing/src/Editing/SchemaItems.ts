/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { SchemaItemKey, SchemaItemProps } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @internal
 * A class allowing you to edit the schema item base class.
 */
export class SchemaItems {
  public constructor(protected _schemaEditor: SchemaContextEditor) { }
  public async applyProps(schemaItemKey: SchemaItemKey, schemItemProps: SchemaItemProps): Promise<void> {
    const schemaItem = await this._schemaEditor.schemaContext.getSchemaItem(schemaItemKey);

    if (schemaItem === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Schema Item ${schemaItemKey.fullName} not found in schema context.`);

    await schemaItem.fromJSON(schemItemProps);
  }
}

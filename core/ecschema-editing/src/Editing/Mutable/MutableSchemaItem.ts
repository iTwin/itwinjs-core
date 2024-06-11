/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {SchemaItem} from "@itwin/ecschema-metadata";

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableSchemaItem extends SchemaItem {
  public abstract override setDescription(description: string): void;
  public abstract override setDisplayLabel(displayLabel: string): void;
}

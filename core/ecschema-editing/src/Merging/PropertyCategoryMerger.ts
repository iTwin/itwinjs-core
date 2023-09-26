/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyCategory } from "@itwin/ecschema-metadata";
import { PropertyValueResolver, SchemaItemMerger } from "./SchemaItemMerger";

/**
 * @internal
 */
export default class PropertyCategoryMerger extends SchemaItemMerger<PropertyCategory> {
  /**
   * Creates the property value resolver for [[PropertyCategory]] items.
   * PropertyCategories only have a priority property which don't need special handling.
   */
  protected override async createPropertyValueResolver(): Promise<PropertyValueResolver<PropertyCategory>> {
    return {
      priority: (value: number) => value,
    };
  }
}

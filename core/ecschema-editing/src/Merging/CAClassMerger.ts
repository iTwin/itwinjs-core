// /*---------------------------------------------------------------------------------------------
// * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
// * See LICENSE.md in the project root for license terms and full copyright notice.
// *--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass } from "@itwin/ecschema-metadata";
import { PropertyValueResolver } from "./SchemaItemMerger";
import ClassMerger from "./ClassMerger";

/**
 * @internal
 */
export default class CAClassMerger extends ClassMerger {
  /**
   * Creates the property value resolver for [[CustomAttributeClass]] items.
   */
  protected override async createPropertyValueResolver(): Promise<PropertyValueResolver<CustomAttributeClass>> {
    return {
      // TODO: The other container types should be added instead of overriding the existing flags.
      //       See issue: https://github.com/iTwin/itwinjs-core/issues/6014
      appliesTo: (value: number) => value,
    };
  }
}

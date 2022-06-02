/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaContextEditor } from "./Editor";

/**
 * @alpha
 * A class allowing you to edit EC properties.
 */
export class Properties {
  // TODO: Add more setters for all attributes.
  public constructor(protected _schemaEditor: SchemaContextEditor) { }

  /**
   * Adds a CustomAttribute instance to the Class identified by the given SchemaItemKey
   * @param name The name of the property on which to add the CustomAttribute.
   * @param customAttribute The CustomAttribute instance to add.
   */
  public async addCustomAttribute(classKey: SchemaItemKey, customAttribute: CustomAttribute): Promise<SchemaItemEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    mutableClass.addCustomAttribute(customAttribute);

    const diagnostics = Rules.validateCustomAttributeInstance(mutableClass, customAttribute);

    const result: SchemaItemEditResults = { errorMessage: "" };
    for await (const diagnostic of diagnostics) {
      result.errorMessage += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
    }

    if (result.errorMessage) {
      this.removeCustomAttribute(mutableClass, customAttribute);
      return result;
    }

    return {};
  }
}

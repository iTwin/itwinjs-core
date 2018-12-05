/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { UiComponents, PropertyRecord, PrimitiveValue, PropertyValueFormat, PropertyDescription, ArrayValue, StructValue } from "../ui-components";
import { UiCore } from "@bentley/ui-core";

export default class TestUtils {
  private static _i18n?: I18N;
  private static _uiComponentsInitialized = false;

  public static get i18n(): I18N {
    if (!TestUtils._i18n) {
      // const port = process.debugPort;
      // const i18nOptions = { urlTemplate: "http://localhost:" + port + "/locales/{{lng}}/{{ns}}.json" };
      TestUtils._i18n = new I18N([], "" /*, i18nOptions*/);
    }
    return TestUtils._i18n;
  }

  public static async initializeUiComponents() {
    if (!TestUtils._uiComponentsInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // tslint:disable-line:no-var-requires

      await UiComponents.initialize(TestUtils.i18n);
      await UiCore.initialize(TestUtils.i18n);
      TestUtils._uiComponentsInitialized = true;
    }
  }

  public static terminateUiComponents() {
    UiCore.terminate();
    UiComponents.terminate();
    TestUtils._uiComponentsInitialized = false;
  }

  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  public static createPrimitiveStringProperty(name: string, text: string) {
    const value: PrimitiveValue = {
      displayValue: text,
      value: text,
      valueFormat: PropertyValueFormat.Primitive,
    };

    const description: PropertyDescription = {
      displayLabel: name,
      name,
      typename: "string",
    };

    const property = new PropertyRecord(value, description);
    property.isReadonly = false;
    return property;
  }

  public static createArrayProperty(name: string, items?: PropertyRecord[]) {
    if (!items)
      items = [];

    const value: ArrayValue = {
      items,
      valueFormat: PropertyValueFormat.Array,
      itemsTypeName: items.length !== 0 ? items[0].property.typename : "string",
    };

    const description: PropertyDescription = {
      displayLabel: name,
      name,
      typename: "array",
    };
    const property = new PropertyRecord(value, description);
    property.isReadonly = false;
    return property;
  }

  public static createStructProperty(name: string, members?: { [name: string]: PropertyRecord }) {
    if (!members)
      members = {};

    const value: StructValue = {
      members,
      valueFormat: PropertyValueFormat.Struct,
    };

    const description: PropertyDescription = {
      displayLabel: name,
      name,
      typename: "struct",
    };
    const property = new PropertyRecord(value, description);
    property.isReadonly = false;
    return property;
  }
}

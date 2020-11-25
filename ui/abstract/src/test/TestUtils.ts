/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { UiAbstract } from "../ui-abstract/UiAbstract";

/** @internal */
export class TestUtils {
  private static _i18n?: I18N;
  private static _uiAbstractInitialized = false;

  public static get i18n(): I18N {
    if (!TestUtils._i18n) {
      // const port = process.debugPort;
      // const i18nOptions = { urlTemplate: "http://localhost:" + port + "/locales/{{lng}}/{{ns}}.json" };
      TestUtils._i18n = new I18N();
    }
    return TestUtils._i18n;
  }

  public static async initializeUiAbstract() {
    if (!TestUtils._uiAbstractInitialized) {
      // This is required by our I18n module (specifically the i18next package).
      (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires

      await UiAbstract.initialize(TestUtils.i18n);
      TestUtils._uiAbstractInitialized = true;
    }
  }

  public static terminateUiAbstract() {
    UiAbstract.terminate();
    TestUtils._uiAbstractInitialized = false;
  }

  public static createBubbledEvent(type: string, props = {}) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, props);
    return event;
  }

  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }
}

export default TestUtils;   // eslint-disable-line: no-default-export

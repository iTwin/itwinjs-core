/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ITwinLocalization } from "@itwin/core-i18n";
import { UiAbstract } from "../appui-abstract/UiAbstract";

/** @internal */
export class TestUtils {
  private static _i18n?: ITwinLocalization;
  private static _uiAbstractInitialized = false;

  public static get i18n(): ITwinLocalization {
    return TestUtils._i18n!;
  }

  public static async initializeUiAbstract() {
    if (!TestUtils._uiAbstractInitialized) {
      TestUtils._i18n = new ITwinLocalization();
      await TestUtils._i18n.initialize(["IModelJs"]);

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

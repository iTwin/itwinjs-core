/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ITwinLocalization } from "@itwin/core-i18n";

/** @internal */
export class TestUtils {
  private static _i18n?: ITwinLocalization;
  private static _uiAbstractInitialized = false;

  public static get i18n(): ITwinLocalization {
    return TestUtils._i18n!;
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MapLayersUI } from "../map-layers";

/** @internal */
export class TestUtils {
  private static _uiComponentsInitialized = false;

  public static async initialize() {
    if (!TestUtils._uiComponentsInitialized) {

      await MapLayersUI.initialize(true);
      TestUtils._uiComponentsInitialized = true;
    }
  }

  public static terminateUiComponents() {
    MapLayersUI.terminate();
    TestUtils._uiComponentsInitialized = false;
  }

  /** Waits until all async operations finish */
  public static async flushAsyncOperations() {
    return new Promise((resolve) => setTimeout(resolve));
  }

}

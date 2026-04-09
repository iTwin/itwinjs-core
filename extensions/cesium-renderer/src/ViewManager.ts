/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ViewManager } from "@itwin/core-frontend";

/** @internal */
export function createCesiumViewManager(): ViewManager {
  return new CesiumViewManager();
}

/** @internal */
class CesiumViewManager extends ViewManager {
  protected override updateRenderToScreen() { }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import { useEffect, useState } from "react";
import { IModelApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { ActiveContentChangedEventArgs, ContentViewManager } from "../content/ContentViewManager";

/** React hook that maintains the active viewport.
 * @beta
 */
export function useActiveViewport(): ScreenViewport | undefined {
  const [activeViewport, setActiveViewport] = useState(IModelApp.viewManager.selectedView);
  useEffect(() => {
    const onActiveContentChanged = (_args: ActiveContentChangedEventArgs) => {
      setActiveViewport(IModelApp.viewManager.selectedView);
    };

    ContentViewManager.onActiveContentChangedEvent.addListener(onActiveContentChanged);
    return () => {
      ContentViewManager.onActiveContentChangedEvent.removeListener(onActiveContentChanged);
    };
  }, []);
  return activeViewport;
}

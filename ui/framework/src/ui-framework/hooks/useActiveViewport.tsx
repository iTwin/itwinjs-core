/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Hooks */

import { useState, useEffect } from "react";
import { IModelApp, ScreenViewport, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";

/** React hook that maintains the active viewport.
 * @beta
 */
export function useActiveViewport(): ScreenViewport | undefined {
  const [activeViewport, setActiveViewport] = useState(IModelApp.viewManager.selectedView);
  useEffect(() => {
    const onSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
      setActiveViewport(args.current);
    };

    IModelApp.viewManager.onSelectedViewportChanged.addListener(onSelectedViewportChanged);
    return () => {
      IModelApp.viewManager.onSelectedViewportChanged.removeListener(onSelectedViewportChanged);
    };
  }, []);
  return activeViewport;
}

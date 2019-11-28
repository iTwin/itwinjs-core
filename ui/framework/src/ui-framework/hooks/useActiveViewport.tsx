/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Hooks */

import { useState, useEffect } from "react";
import { IModelApp, ScreenViewport, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";

/** React hook that maintains the active viewport.
 * @beta
 */
// istanbul ignore next
export function useActiveViewport(): ScreenViewport | undefined {
  // active viewport changed
  const [activeViewport, setActiveViewport] = useState(IModelApp.viewManager.selectedView);
  useEffect(() => {
    const onSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
      setActiveViewport(args.current);
    };

    IModelApp.viewManager.onSelectedViewportChanged.addListener(onSelectedViewportChanged);
    return () => {
      IModelApp.viewManager.onSelectedViewportChanged.removeListener(onSelectedViewportChanged);
    };
  });
  return activeViewport;
}

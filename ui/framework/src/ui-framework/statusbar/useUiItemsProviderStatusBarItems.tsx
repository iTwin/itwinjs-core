/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import {
  CommonStatusBarItem, StageUsage, StatusBarItemsChangedArgs, StatusBarItemsManager, UiItemsArbiter, UiItemsManager,
} from "@bentley/ui-abstract";
import { useActiveStageId } from "../hooks/useActiveStageId.js";
import { useAvailableUiItemsProviders } from "../hooks/useAvailableUiItemsProviders.js";
import { FrontstageManager } from "../frontstage/FrontstageManager.js";

// cspell:ignore setxxx

/** Hook that returns items from [[StatusBarItemsManager]].
 * @beta
 */
export const useUiItemsProviderStatusBarItems = (manager: StatusBarItemsManager): readonly CommonStatusBarItem[] => {
  const uiItemProviderIds = useAvailableUiItemsProviders();
  const stageId = useActiveStageId();
  const [items, setItems] = React.useState(manager.items);
  const providersRef = React.useRef("");
  const currentStageRef = React.useRef("");
  // gathers items from registered extensions - dependent on when a UiItemsProvider is register or unregistered and if the
  // current stage's composer allows entries from extensions.
  React.useEffect(() => {
    const uiProviders = uiItemProviderIds.join("-");
    // istanbul ignore else
    if (providersRef.current !== uiProviders || currentStageRef.current !== stageId) {
      currentStageRef.current = stageId;
      const frontstageDef = FrontstageManager.findFrontstageDef(stageId);
      // istanbul ignore next
      const usage = frontstageDef?.usage ? frontstageDef.usage : StageUsage.General;
      providersRef.current = uiProviders;
      const statusBarItems = UiItemsManager.getStatusBarItems(stageId, usage);
      const updatedStatusBarItems = UiItemsArbiter.updateStatusBarItems(statusBarItems);
      manager.loadItems(updatedStatusBarItems);
      setItems(manager.items);
    }

  }, [manager, uiItemProviderIds, stageId]);
  // handle item changes caused by calls to UiFramework.addonStatusBarItemsManager.setxxx
  React.useEffect(() => {
    const handleChanged = (args: StatusBarItemsChangedArgs) => {
      setItems(args.items);
    };
    manager.onItemsChanged.addListener(handleChanged);
    return () => {
      manager.onItemsChanged.removeListener(handleChanged);
    };
  }, [manager]);
  return items;
};

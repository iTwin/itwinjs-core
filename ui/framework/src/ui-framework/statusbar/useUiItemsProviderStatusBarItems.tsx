/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { UiItemsManager, UiItemsArbiter, StatusBarItemsManager, StageUsage, StatusBarItemsChangedArgs, CommonStatusBarItem } from "@bentley/ui-abstract";
import { useActiveStageId } from "../hooks/useActiveStageId";
import { useAvailableUiItemsProviders } from "../hooks/useAvailableUiItemsProviders";

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
  // gathers items from registered plugins - dependent on when a UiItemsProvider is register or unregistered and if the
  // current stage's composer allows entries from plugins.
  React.useEffect(() => {
    const uiProviders = uiItemProviderIds.join("-");
    // istanbul ignore else
    if (providersRef.current !== uiProviders || currentStageRef.current !== stageId) {
      currentStageRef.current = stageId;
      providersRef.current = uiProviders;
      const statusBarItems = UiItemsManager.getStatusBarItems(stageId, StageUsage.General);
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

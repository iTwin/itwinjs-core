/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import {
  CommonStatusBarItem, StatusBarItemsChangedArgs, StatusBarItemsManager, UiItemsManager,
} from "@itwin/appui-abstract";
import { useActiveStageId } from "../hooks/useActiveStageId";
import { useAvailableUiItemsProviders } from "../hooks/useAvailableUiItemsProviders";
import { FrontstageManager } from "../frontstage/FrontstageManager";

// cspell:ignore setxxx

/** Hook that returns items from [[StatusBarItemsManager]].
 * @public
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
      const frontstageDef = FrontstageManager.activeFrontstageDef;
      // istanbul ignore else
      if (frontstageDef) {
        providersRef.current = uiProviders;
        const statusBarItems = UiItemsManager.getStatusBarItems(stageId, frontstageDef.usage, frontstageDef.applicationData);
        manager.loadItems(statusBarItems);
        setItems(manager.items);
      }
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

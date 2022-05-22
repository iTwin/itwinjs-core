/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import {
  CommonToolbarItem, ToolbarItemsChangedArgs, ToolbarItemsManager, ToolbarOrientation, ToolbarUsage, UiItemsManager,
} from "@itwin/appui-abstract";
import { useActiveStageId } from "../hooks/useActiveStageId";
import { useAvailableUiItemsProviders } from "../hooks/useAvailableUiItemsProviders";
import { FrontstageManager } from "../frontstage/FrontstageManager";

/** Hook that returns items from [[ToolbarItemsManager]].
 * @public
 */
export const useUiItemsProviderToolbarItems = (manager: ToolbarItemsManager, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): readonly CommonToolbarItem[] => {
  const uiItemsProviderIds = useAvailableUiItemsProviders();
  const stageId = useActiveStageId();
  const [items, setItems] = React.useState(manager.items);
  const providersRef = React.useRef("");
  const currentStageRef = React.useRef("");
  // gathers items from registered extensions - dependent on when a uiItemsProvider is register or unregistered and if the
  // current stage's composer allows entries from extensions.
  React.useEffect(() => {
    const uiProviders = uiItemsProviderIds.join("-");
    const handleChanged = (args: ToolbarItemsChangedArgs) => {
      setItems(args.items);
    };
    manager.onItemsChanged.addListener(handleChanged);
    // istanbul ignore else
    if (providersRef.current !== uiProviders || currentStageRef.current !== stageId) {
      const frontstageDef = FrontstageManager.activeFrontstageDef;
      // istanbul ignore else
      if (frontstageDef) {
        const usage = frontstageDef.usage;
        const applicationData = frontstageDef.applicationData;
        currentStageRef.current = stageId;
        providersRef.current = uiProviders;
        const toolbarItems = UiItemsManager.getToolbarButtonItems(stageId, usage, toolbarUsage, toolbarOrientation, applicationData);
        manager.loadItems(toolbarItems);
        setItems(manager.items);
      }
    }
    return () => {
      manager.onItemsChanged.removeListener(handleChanged);
    };
  }, [uiItemsProviderIds, stageId, manager, toolbarUsage, toolbarOrientation]);
  return items;
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import {
  CommonToolbarItem, StageUsage, ToolbarItemsChangedArgs, ToolbarItemsManager, ToolbarOrientation, ToolbarUsage, UiItemsArbiter, UiItemsManager,
} from "@bentley/ui-abstract";
import { useActiveStageId } from "../hooks/useActiveStageId.js";
import { useAvailableUiItemsProviders } from "../hooks/useAvailableUiItemsProviders.js";
import { FrontstageManager } from "../frontstage/FrontstageManager.js";

/** Hook that returns items from [[ToolbarItemsManager]].
 * @beta
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
      const frontstageDef = FrontstageManager.findFrontstageDef(stageId);
      // istanbul ignore next
      const usage = frontstageDef?.usage ? frontstageDef.usage : StageUsage.General;
      currentStageRef.current = stageId;
      providersRef.current = uiProviders;
      const toolbarItems = UiItemsManager.getToolbarButtonItems(stageId, usage, toolbarUsage, toolbarOrientation);
      const updatedToolbarItems = UiItemsArbiter.updateToolbarButtonItems(toolbarItems);
      manager.loadItems(updatedToolbarItems);
      setItems(manager.items);
    }
    return () => {
      manager.onItemsChanged.removeListener(handleChanged);
    };
  }, [uiItemsProviderIds, stageId, manager, toolbarUsage, toolbarOrientation]);
  return items;
};

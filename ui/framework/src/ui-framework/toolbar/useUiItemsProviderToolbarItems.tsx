/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import { UiItemsManager, UiItemsArbiter, StageUsage, CommonToolbarItem, ToolbarUsage, ToolbarOrientation, ToolbarItemsManager } from "@bentley/ui-abstract";
import { useActiveStageId } from "../hooks/useActiveStageId";
import { useAvailableUiItemsProviders } from "../hooks/useAvailableUiItemsProviders";

/** Hook that returns items from [[ToolbarItemsManager]].
 * @beta
 */
export const useUiItemsProviderToolbarItems = (manager: ToolbarItemsManager, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): readonly CommonToolbarItem[] => {
  const uiItemsProviderIds = useAvailableUiItemsProviders();
  const stageId = useActiveStageId();
  const [items, setItems] = React.useState(manager.items);
  const providersRef = React.useRef("");
  const currentStageRef = React.useRef("");
  // gathers items from registered plugins - dependent on when a uiItemsProvider is register or unregistered and if the
  // current stage's composer allows entries from plugins.
  React.useEffect(() => {
    const uiProviders = uiItemsProviderIds.join("-");
    // istanbul ignore else
    if (providersRef.current !== uiProviders || currentStageRef.current !== stageId) {
      currentStageRef.current = stageId;
      providersRef.current = uiProviders;
      const toolbarItems = UiItemsManager.getToolbarButtonItems(stageId, StageUsage.General, toolbarUsage, toolbarOrientation);
      const updatedToolbarItems = UiItemsArbiter.updateToolbarButtonItems(toolbarItems);
      manager.loadItems(updatedToolbarItems);
      setItems(manager.items);
    }
  }, [uiItemsProviderIds, stageId, manager, toolbarUsage, toolbarOrientation]);
  return items;
};

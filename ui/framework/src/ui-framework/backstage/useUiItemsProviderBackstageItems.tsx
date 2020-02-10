/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { UiItemsManager, UiItemsArbiter, BackstageItemsManager, BackstageItem, BackstageItemsChangedArgs } from "@bentley/ui-abstract";
import { useAvailableUiItemsProviders } from "../hooks/useAvailableUiItemsProviders";

// cspell:ignore setxxx

/** Hook that returns items from [[BackstageItemsManager]].
 * @beta
 */
export const useUiItemsProviderBackstageItems = (manager: BackstageItemsManager): readonly BackstageItem[] => {
  const uiItemProviderIds = useAvailableUiItemsProviders();
  const [items, setItems] = React.useState(manager ? manager.items : []);
  const providersRef = React.useRef("");
  // gathers items from registered plugins - dependent on when a UiItemsProvider is register or unregistered and if the
  // current stage's composer allows entries from plugins.
  React.useEffect(() => {
    const uiProviders = uiItemProviderIds.join("-");
    // istanbul ignore else
    if (providersRef.current !== uiProviders) {
      providersRef.current = uiProviders;
      const backstageItems = UiItemsManager.getBackstageItems();
      const updatedBackstageItems = UiItemsArbiter.updateBackstageItems(backstageItems);
      manager.loadItems(updatedBackstageItems);
      setItems(manager.items);
    }
  }, [manager, uiItemProviderIds]);
  // handle item changes caused by calls to UiFramework.addonStatusBarItemsManager.setxxx
  React.useEffect(() => {
    const handleChanged = (args: BackstageItemsChangedArgs) => {
      setItems(args.items);
    };
    manager.onItemsChanged.addListener(handleChanged);
    return () => {
      manager.onItemsChanged.removeListener(handleChanged);
    };
  }, [manager]);
  return items;
};

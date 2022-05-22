/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import { useEffect, useState } from "react";
import { UiItemsManager } from "@itwin/appui-abstract";

/** React hook that maintains the number of available UiItemsProviders. This allows components to use it to refresh when a
 * UiItemsProviders is added or removed allowing the ui component to be re-rendered.
 * @internal
 */
export function useAvailableUiItemsProviders(): readonly string[] {
  const [uiItemsProviderIds, setUiItemsProviderIds] = useState(UiItemsManager.registeredProviderIds);
  useEffect(() => {
    const handleUiProviderRegisteredEvent = (): void => {
      setUiItemsProviderIds(UiItemsManager.registeredProviderIds);
    };

    UiItemsManager.onUiProviderRegisteredEvent.addListener(handleUiProviderRegisteredEvent);
    return () => {
      UiItemsManager.onUiProviderRegisteredEvent.removeListener(handleUiProviderRegisteredEvent);
    };
  }, []);

  return uiItemsProviderIds;
}

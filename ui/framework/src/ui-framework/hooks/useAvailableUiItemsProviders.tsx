/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import { useState, useEffect } from "react";
import { UiItemsManager } from "@bentley/ui-abstract";

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

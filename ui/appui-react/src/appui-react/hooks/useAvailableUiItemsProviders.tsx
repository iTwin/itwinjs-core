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
  const [uiItemsProviderIds, setUiItemsProviderIds] = useState(UiItemsManager.registeredProviderIds); // eslint-disable-line deprecation/deprecation
  useEffect(() => {
    const handleUiProviderRegisteredEvent = (): void => {
      setUiItemsProviderIds(UiItemsManager.registeredProviderIds); // eslint-disable-line deprecation/deprecation
    };

    UiItemsManager.onUiProviderRegisteredEvent.addListener(handleUiProviderRegisteredEvent); // eslint-disable-line deprecation/deprecation
    return () => {
      UiItemsManager.onUiProviderRegisteredEvent.removeListener(handleUiProviderRegisteredEvent); // eslint-disable-line deprecation/deprecation
    };
  }, []);

  return uiItemsProviderIds;
}

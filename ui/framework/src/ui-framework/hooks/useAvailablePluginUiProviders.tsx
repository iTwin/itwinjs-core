/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Hooks */

import { useState, useEffect } from "react";
import { PluginUiManager } from "@bentley/ui-abstract";

/** React hook that maintains the number of available PluginUiProviders. This allows components to use it to refresh when a
 * PluginUiProviders is added or removed allowing the ui component to be re-rendered.
 * @internal
 */
export function useAvailablePluginUiProviders(): readonly string[] {
  const [pluginUiProviderIds, setPluginUiProviderIds] = useState(PluginUiManager.registeredProviderIds);
  useEffect(() => {
    const handleUiProviderRegisteredEvent = (): void => {
      setPluginUiProviderIds(PluginUiManager.registeredProviderIds);
    };

    PluginUiManager.onUiProviderRegisteredEvent.addListener(handleUiProviderRegisteredEvent);
    return () => {
      PluginUiManager.onUiProviderRegisteredEvent.removeListener(handleUiProviderRegisteredEvent);
    };
  }, []);

  return pluginUiProviderIds;
}

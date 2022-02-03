/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import { useEffect, useState } from "react";
import type { UiSyncEventArgs } from "@itwin/appui-abstract";
import type { ScreenViewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { ActiveContentChangedEventArgs} from "../content/ContentViewManager";
import { ContentViewManager } from "../content/ContentViewManager";
import { SyncUiEventDispatcher, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";

/** React hook that maintains the active viewport.
 * @public
 */
// istanbul ignore next
export function useActiveViewport(): ScreenViewport | undefined {
  const [activeViewport, setActiveViewport] = useState(IModelApp.viewManager.selectedView);
  useEffect(() => {
    const onActiveContentChanged = (_args: ActiveContentChangedEventArgs) => {
      setActiveViewport(IModelApp.viewManager.selectedView);
    };

    // IModelApp.viewManager.onSelectedViewportChanged will often fire before UI components have mounted
    // so use ContentViewManager.onActiveContentChangedEvent which will always trigger once all stage components
    // are loaded and when the IModelApp.viewManager.selectedView changes.
    ContentViewManager.onActiveContentChangedEvent.addListener(onActiveContentChanged);
    return () => {
      ContentViewManager.onActiveContentChangedEvent.removeListener(onActiveContentChanged);
    };
  }, []);

  useEffect(() => {
    const syncIdsOfInterest = [SyncUiEventId.ActiveContentChanged, SyncUiEventId.ContentControlActivated, SyncUiEventId.FrontstageReady];
    const handleSyncUiEvent = (args: UiSyncEventArgs): void => {
      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        const activeContentControl = ContentViewManager.getActiveContentControl();
        setActiveViewport(activeContentControl && activeContentControl.viewport);
      }
    };

    return SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
  }, []);

  return activeViewport;
}

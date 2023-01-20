/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import { useEffect, useState } from "react";
import { UiSyncEventArgs } from "@itwin/appui-abstract";
import { IModelApp, ScreenViewport } from "@itwin/core-frontend";
import { ActiveContentChangedEventArgs } from "../content/ContentViewManager";
import { SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { UiFramework } from "../UiFramework";

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
    // so use UiFramework.content.onActiveContentChangedEvent which will always trigger once all stage components
    // are loaded and when the IModelApp.viewManager.selectedView changes.
    UiFramework.content.onActiveContentChangedEvent.addListener(onActiveContentChanged);
    return () => {
      UiFramework.content.onActiveContentChangedEvent.removeListener(onActiveContentChanged);
    };
  }, []);

  useEffect(() => {
    const syncIdsOfInterest = [SyncUiEventId.ActiveContentChanged, SyncUiEventId.ContentControlActivated, SyncUiEventId.FrontstageReady];
    const handleSyncUiEvent = (args: UiSyncEventArgs): void => {
      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        const activeContentControl = UiFramework.content.getActiveContentControl();
        setActiveViewport(activeContentControl && activeContentControl.viewport);
      }
    };

    return UiFramework.events.onSyncUiEvent.addListener(handleSyncUiEvent);
  }, []);

  return activeViewport;
}

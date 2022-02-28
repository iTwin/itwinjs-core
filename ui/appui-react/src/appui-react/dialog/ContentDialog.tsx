/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import "./ContentDialog.scss";
import * as React from "react";
import { Dialog, DialogProps } from "@itwin/core-react";
import { ContentDialogManager } from "./ContentDialogManager";
import { ActiveContentChangedEventArgs, ContentViewManager } from "../content/ContentViewManager";
import { SyncUiEventDispatcher, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { UiSyncEventArgs } from "@itwin/appui-abstract";
import classnames from "classnames";

// istanbul ignore next
/**
 *@internal
 */
export function useActiveContentControlId(): string | undefined {
  const [activeContentId, setActiveContentId] = React.useState(ContentViewManager.getActiveContentControl()?.uniqueId);

  React.useEffect(() => {
    const onActiveContentChanged = (_args: ActiveContentChangedEventArgs) => {
      setActiveContentId(ContentViewManager.getActiveContentControl()?.uniqueId);
    };

    // IModelApp.viewManager.onSelectedViewportChanged will often fire before UI components have mounted
    // so use ContentViewManager.onActiveContentChangedEvent which will always trigger once all stage components
    // are loaded and when the IModelApp.viewManager.selectedView changes.
    ContentViewManager.onActiveContentChangedEvent.addListener(onActiveContentChanged);
    return () => {
      ContentViewManager.onActiveContentChangedEvent.removeListener(onActiveContentChanged);
    };
  }, []);

  React.useEffect(() => {
    const syncIdsOfInterest = [SyncUiEventId.ActiveContentChanged, SyncUiEventId.ContentControlActivated, SyncUiEventId.FrontstageReady];
    const handleSyncUiEvent = (args: UiSyncEventArgs): void => {
      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        setActiveContentId(ContentViewManager.getActiveContentControl()?.uniqueId);
      }
    };

    return SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
  }, []);

  return activeContentId;
}

/** Properties for the [[ContentDialog]] component
 * @public
 */
export interface ContentDialogProps extends DialogProps {
  dialogId: string;
  movable?: boolean;
  children: React.ReactNode;
}

/** Content Dialog React component uses the Dialog component with a modal={false} prop.
 * It controls the z-index to keep the focused dialog above content but below widgets.
 * @public
 */
export function ContentDialog(props: ContentDialogProps) {
  const { className, children, dialogId, style, modal, modelessId, onModelessPointerDown, ...otherProps } = props; // eslint-disable-line @typescript-eslint/no-unused-vars
  const activeContentControlId = useActiveContentControlId();
  // istanbul ignore next
  const dialogClassName = React.useMemo(() => classnames(activeContentControlId === dialogId ? "active-content-dialog" : "inactive-content-dialog", className),
    [activeContentControlId, className, dialogId]);

  const [zIndex, setZIndex] = React.useState(ContentDialogManager.getDialogZIndex(dialogId));
  const updateZIndex = React.useCallback(() => {
    const newZ = ContentDialogManager.getDialogZIndex(dialogId);
    // istanbul ignore else
    if (newZ !== zIndex) {
      setZIndex(newZ);
    }
  }, [dialogId, zIndex]);

  return (
    <Dialog
      className={dialogClassName}
      data-item-type="content-dialog"
      data-item-id={dialogId}
      resizable={true}
      movable={true}
      trapFocus={false}
      modal={false}
      {...otherProps}
      modelessId={dialogId}
      onModelessPointerDown={(event) => ContentDialogManager.handlePointerDownEvent(event, dialogId, updateZIndex)}
      style={{ zIndex, ...style }}
    >
      {children}
    </Dialog >
  );
}


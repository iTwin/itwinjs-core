/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiSyncEvent } from "@itwin/appui-abstract";
import { IModelConnection } from "@itwin/core-frontend";

// cSpell:ignore activecontentchanged, activitymessageupdated, activitymessagecancelled, backstagecloseevent, backstageevent, contentlayoutactivated, contentcontrolactivated,
// cSpell:ignore elementtooltipchanged, frontstageactivated, inputfieldmessageadded, inputfieldmessageremoved, modalfrontstagechanged, modaldialogchanged
// cSpell:ignore navigationaidactivated, notificationmessageadded, toolactivated, taskactivated, widgetstatechanged, workflowactivated frontstageactivating
// cSpell:ignore frontstageready activeviewportchanged selectionsetchanged presentationselectionchanged viewstatechanged
// cSpell:ignore accudrawcompassmodechanged accudrawfieldlockchanged accudrawrotationchanged uisettingschanged

/** Event Id used to sync UI components. Used to refresh visibility or enable state of control.
 * @public
 */
export enum SyncUiEventId {
  /** AccuDraw compass mode has changed. */
  AccuDrawCompassModeChanged = "accudrawcompassmodechanged",
  /** AccuDraw rotation has changed. */
  AccuDrawRotationChanged = "accudrawrotationchanged",
  /** The active content as maintained by the ContentViewManager has changed. */
  ActiveContentChanged = "activecontentchanged",
  /** The active view maintained by the ViewManager has changed. */
  ActiveViewportChanged = "activeviewportchanged",
  /** Backstage has been closed.
   * @deprecated in 1.x. Use BackstageEvent instead
   */
  BackstageCloseEvent = "backstagecloseevent",
  /** Backstage has been closed. */
  BackstageEvent = "backstageevent",
  /** A Content Layout has been activated.  */
  ContentLayoutActivated = "contentlayoutactivated",
  /** A Content Control maintained by FrontstageManager has been activated. */
  ContentControlActivated = "contentcontrolactivated",
  /** A Frontstage is activating. */
  FrontstageActivating = "frontstageactivating",
  /** A Frontstage has been activated and the content has been assigned. */
  FrontstageReady = "frontstageready",
  /** A Modal Frontstage has been opened or closed. */
  ModalFrontstageChanged = "modalfrontstagechanged",
  /** A Modal Dialog has been opened or closed. */
  ModalDialogChanged = "modaldialogchanged",
  /** A NavigationAid has been activated. */
  NavigationAidActivated = "navigationaidactivated",
  /** An InteractiveTool has been activated via the ToolAdmin. */
  ToolActivated = "toolactivated",
  /** A Task has been activated.
   * @deprecated in 3.0. */
  TaskActivated = "taskactivated",
  /** The state of a Widget has changed. */
  WidgetStateChanged = "widgetstatechanged",
  /** A Workflow has been activated.
   * @deprecated in 3.0. */
  WorkflowActivated = "workflowactivated",
  /** The SelectionSet for the active IModelConnection has changed. */
  SelectionSetChanged = "selectionsetchanged",
  /** The list of settings providers registered with SettingsManager has changed. */
  SettingsProvidersChanged = "settingsproviderschanged",
  /** The current view state has changed (used by view undo/redo toolbar buttons). */
  ViewStateChanged = "viewstatechanged",
  /** The current object the reads and write UI State has changed. */
  UiStateStorageChanged = "uistatestoragechanged",
  ShowHideManagerSettingChange = "show-hide-setting-change",
  /** The list of feature overrides applied has been changed
   * @alpha
  */
  FeatureOverridesChanged = "featureoverrideschanged"
}

/**
 * [[UiFramework.events]] interface
 * @beta
 */
export interface FrameworkEvents {
  /** Return set of event ids that will be sent to listeners/. */
  readonly syncEventIds: Set<string>;

  /** Return SyncUiEvent so callers can register an event callback. */
  readonly onSyncUiEvent: UiSyncEvent;

  /** Immediately trigger sync event processing. */
  dispatchImmediateSyncUiEvent(eventId: string): void;

  /** Save eventId in Set for processing. */
  dispatchSyncUiEvent(eventId: string): void;

  /** Save multiple eventIds in Set for processing. */
  dispatchSyncUiEvents(eventIds: string[]): void;

  /** Checks to see if an eventId of interest is contained in the set of eventIds */
  hasEventOfInterest(eventIds: Set<string>, idsOfInterest: string[]): boolean;

  /** This should be called by IModelApp when the active IModelConnection is closed. */
  clearConnectionEvents(iModelConnection: IModelConnection): void;

  /** This should be called by IModelApp when the active IModelConnection is established. */
  initializeConnectionEvents(iModelConnection: IModelConnection): void;

}

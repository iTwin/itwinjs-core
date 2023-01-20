/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SyncUi
 */

import { UiEventDispatcher, UiSyncEvent, UiSyncEventArgs } from "@itwin/appui-abstract";
import { Logger } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, SelectedViewportChangedArgs, SelectionSetEvent } from "@itwin/core-frontend";
import { getInstancesCount, SelectionScope } from "@itwin/presentation-common";
import { ISelectionProvider, Presentation, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
// cSpell:ignore configurableui
import { Backstage } from "../backstage/Backstage";
import { PresentationSelectionScope, SessionStateActionId } from "../redux/SessionState";
import { UiFramework } from "../UiFramework";
import { WorkflowManager } from "../workflow/Workflow";

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
   * @deprecated Use BackstageEvent instead
   */
  BackstageCloseEvent = "backstagecloseevent",
  /** Backstage has been closed. */
  BackstageEvent = "backstageevent",
  /** A Content Layout has been activated.  */
  ContentLayoutActivated = "contentlayoutactivated",
  /** A Content Control maintained by UiFramework.frontstages has been activated. */
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
   * @deprecated */
  TaskActivated = "taskactivated",
  /** The state of a Widget has changed. */
  WidgetStateChanged = "widgetstatechanged",
  /** A Workflow has been activated.
   * @deprecated */
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

/** SyncUi Event arguments. Contains a set of lower case event Ids.
 * @public @deprecated use UiSyncEventArgs in appui-abstract instead
 */
export type SyncUiEventArgs = UiSyncEventArgs;

/** SyncUi Event class.
 * @public @deprecated use UiSyncEvent in appui-abstract instead
 */
export type SyncUiEvent = UiSyncEvent;

/** This class is used to send eventIds to interested UI components so the component can determine if it needs
 * to refresh its display by calling setState on itself.
 * @internal
 */
export class InternalSyncUiEventDispatcher {
  private static _uiEventDispatcher = new UiEventDispatcher();
  private static _unregisterListenerFunc?: () => void;
  private static _unregisterListenerFuncs: Array<() => void> = [];
  private static initialized = false;

  /** @internal - used for testing only */
  /* istanbul ignore next */
  public static setTimeoutPeriod(period: number): void {
    InternalSyncUiEventDispatcher._uiEventDispatcher.setTimeoutPeriod(period);
  }

  /** Return set of event ids that will be sent to listeners/. */
  public static get syncEventIds(): Set<string> {
    return InternalSyncUiEventDispatcher._uiEventDispatcher.syncEventIds;
  }

  /** Return SyncUiEvent so callers can register an event callback. */
  // eslint-disable-next-line deprecation/deprecation
  public static get onSyncUiEvent(): SyncUiEvent {
    return InternalSyncUiEventDispatcher._uiEventDispatcher.onSyncUiEvent;
  }

  /** Immediately trigger sync event processing. */
  public static dispatchImmediateSyncUiEvent(eventId: string): void {
    InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchImmediateSyncUiEvent(eventId);
  }

  /** Save eventId in Set for processing. */
  public static dispatchSyncUiEvent(eventId: string): void {
    if (0 === InternalSyncUiEventDispatcher._uiEventDispatcher.timeoutPeriod) {
      Logger.logInfo(UiFramework.loggerCategory(this), `[dispatchSyncUiEvent] not processed because timeoutPeriod=0`);
      return;
    }
    InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(eventId);
  }

  /** Save multiple eventIds in Set for processing. */
  public static dispatchSyncUiEvents(eventIds: string[]): void {
    // istanbul ignore if
    if (0 === InternalSyncUiEventDispatcher._uiEventDispatcher.timeoutPeriod) {
      Logger.logInfo(UiFramework.loggerCategory(this), `[dispatchSyncUiEvents] not processed because _timeoutPeriod=0`);
    }
    InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvents(eventIds);
  }

  /** Checks to see if an eventId of interest is contained in the set of eventIds */
  public static hasEventOfInterest(eventIds: Set<string>, idsOfInterest: string[]) {
    return InternalSyncUiEventDispatcher._uiEventDispatcher.hasEventOfInterest(eventIds, idsOfInterest);
  }

  // istanbul ignore next
  private static _dispatchViewChange() {
    InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ViewStateChanged);
  }

  // istanbul ignore next
  private static _dispatchFeatureOverridesChange() {
    InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.FeatureOverridesChanged);
  }

  /** Initializes the Monitoring of Events that trigger dispatching sync events.
   * @internal
  */
  public static initialize() {
    // clear any registered listeners - this should only be encountered in unit test scenarios
    this._unregisterListenerFuncs.forEach((unregisterListenerFunc) => unregisterListenerFunc());

    this._unregisterListenerFuncs.push(UiFramework.frontstages.onContentControlActivatedEvent.addListener(() => {
      InternalSyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ContentControlActivated);
    }));

    this._unregisterListenerFuncs.push(UiFramework.frontstages.onContentLayoutActivatedEvent.addListener(() => {
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ContentLayoutActivated);
    }));

    this._unregisterListenerFuncs.push(UiFramework.frontstages.onFrontstageActivatedEvent.addListener(() => {
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.FrontstageActivating);
    }));

    this._unregisterListenerFuncs.push(UiFramework.frontstages.onFrontstageReadyEvent.addListener(() => {
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.FrontstageReady);
    }));

    this._unregisterListenerFuncs.push(UiFramework.frontstages.onModalFrontstageChangedEvent.addListener(() => {
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ModalFrontstageChanged);
    }));

    this._unregisterListenerFuncs.push(UiFramework.frontstages.onNavigationAidActivatedEvent.addListener(() => {
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.NavigationAidActivated);
    }));

    this._unregisterListenerFuncs.push(UiFramework.frontstages.onToolActivatedEvent.addListener(() => {
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ToolActivated);
    }));

    this._unregisterListenerFuncs.push(UiFramework.frontstages.onWidgetStateChangedEvent.addListener(() => {
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.WidgetStateChanged);
    }));

    this._unregisterListenerFuncs.push(Backstage.onBackstageEvent.addListener(() => { // eslint-disable-line deprecation/deprecation
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.BackstageEvent);
    }));

    this._unregisterListenerFuncs.push(WorkflowManager.onTaskActivatedEvent.addListener(() => { // eslint-disable-line deprecation/deprecation
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.TaskActivated); // eslint-disable-line deprecation/deprecation
    }));

    this._unregisterListenerFuncs.push(WorkflowManager.onWorkflowActivatedEvent.addListener(() => { // eslint-disable-line deprecation/deprecation
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.WorkflowActivated); // eslint-disable-line deprecation/deprecation
    }));

    this._unregisterListenerFuncs.push(UiFramework.content.onActiveContentChangedEvent.addListener(() => {
      InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ActiveContentChanged);
    }));

    // istanbul ignore else
    if (IModelApp && IModelApp.viewManager) {
      this._unregisterListenerFuncs.push(IModelApp.viewManager.onSelectedViewportChanged.addListener((args: SelectedViewportChangedArgs) => {
        InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ActiveViewportChanged);

        // if this is the first view being opened up start the default tool so tool admin is happy.
        if (undefined === args.previous) {
          IModelApp.toolAdmin.startDefaultTool();// eslint-disable-line @typescript-eslint/no-floating-promises
        } else {
          // istanbul ignore next
          if (args.previous.onViewChanged && typeof args.previous.onViewChanged.removeListener === "function")  // not set during unit test
            args.previous.onViewChanged.removeListener(InternalSyncUiEventDispatcher._dispatchViewChange);
          // istanbul ignore next
          if (args.previous.onFeatureOverridesChanged && typeof args.previous.onFeatureOverridesChanged.removeListener === "function")  // not set during unit test
            args.previous.onFeatureOverridesChanged.removeListener(InternalSyncUiEventDispatcher._dispatchFeatureOverridesChange);
        }
        // istanbul ignore next
        if (args.current) {
          if (args.current.onViewChanged && typeof args.current.onViewChanged.addListener === "function") // not set during unit test
            args.current.onViewChanged.addListener(InternalSyncUiEventDispatcher._dispatchViewChange);
          // istanbul ignore next
          if (args.current.onFeatureOverridesChanged && typeof args.current.onFeatureOverridesChanged.addListener === "function") // not set during unit test
            args.current.onFeatureOverridesChanged.addListener(InternalSyncUiEventDispatcher._dispatchFeatureOverridesChange);
        }
      }));
    }
  }

  private static selectionChangedHandler(_ev: SelectionSetEvent) {
    InternalSyncUiEventDispatcher._uiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.SelectionSetChanged);
  }

  /** This should be called by IModelApp when the active IModelConnection is closed. */
  public static clearConnectionEvents(iModelConnection: IModelConnection) {
    iModelConnection.selectionSet.onChanged.removeListener(InternalSyncUiEventDispatcher.selectionChangedHandler);
    InternalSyncUiEventDispatcher._unregisterListenerFunc && InternalSyncUiEventDispatcher._unregisterListenerFunc();
  }

  /** This should be called by IModelApp when the active IModelConnection is established. */
  public static initializeConnectionEvents(iModelConnection: IModelConnection) {
    if (InternalSyncUiEventDispatcher._unregisterListenerFunc)
      InternalSyncUiEventDispatcher._unregisterListenerFunc();

    if (iModelConnection.isBlankConnection() || !iModelConnection.isOpen) {
      UiFramework.dispatchActionToStore(SessionStateActionId.SetNumItemsSelected, 0);
      return;
    }

    iModelConnection.selectionSet.onChanged.removeListener(InternalSyncUiEventDispatcher.selectionChangedHandler);
    iModelConnection.selectionSet.onChanged.addListener(InternalSyncUiEventDispatcher.selectionChangedHandler);
    (iModelConnection.iModelId) ? UiFramework.setActiveIModelId(iModelConnection.iModelId) : /* istanbul ignore next */ "";

    // listen for changes from presentation rules selection manager (this is done once an iModelConnection is available to ensure Presentation.selection is valid)
    InternalSyncUiEventDispatcher._unregisterListenerFunc = Presentation.selection.selectionChange.addListener((args: SelectionChangeEventArgs, provider: ISelectionProvider) => {
      // istanbul ignore if
      if (args.level !== 0) {
        // don't need to handle sub-selections
        return;
      }
      const selection = provider.getSelection(args.imodel, args.level);
      const numSelected = getInstancesCount(selection);
      UiFramework.dispatchActionToStore(SessionStateActionId.SetNumItemsSelected, numSelected);
    });

    try {
      Presentation.selection.scopes.getSelectionScopes(iModelConnection).then((availableScopes: SelectionScope[]) => { // eslint-disable-line @typescript-eslint/no-floating-promises
        // istanbul ignore else
        if (availableScopes) {
          const presentationScopes: PresentationSelectionScope[] = [];
          availableScopes.map((scope) => presentationScopes.push(scope));
          UiFramework.dispatchActionToStore(SessionStateActionId.SetAvailableSelectionScopes, presentationScopes);
        }
      });

      const activeSelectionScope = Presentation.selection.scopes.activeScope;
      if (activeSelectionScope) {
        if (typeof (activeSelectionScope) === "object") {
          UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, activeSelectionScope.id);
        } else {
          UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, activeSelectionScope);
        }
      }
    } catch {}

  }

}

/** This class is used to send eventIds to interested UI components so the component can determine if it needs
 * to refresh its display by calling setState on itself.
 * @public
 * @deprecated in 3.6. Use `UiFramework.events` property.
 */
export class SyncUiEventDispatcher extends InternalSyncUiEventDispatcher {
  /** Initializes the Monitoring of Events that trigger dispatching sync events.
   * @deprecated in 3.6. This is called internally.
  */
  public static override initialize() {
    InternalSyncUiEventDispatcher.initialize();
  }
}

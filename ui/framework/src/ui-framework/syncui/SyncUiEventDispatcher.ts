/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SyncUi
 */

import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp, IModelConnection, SelectedViewportChangedArgs, SelectionSetEvent } from "@bentley/imodeljs-frontend";
import { getInstancesCount, SelectionScope } from "@bentley/presentation-common";
import { ISelectionProvider, Presentation, SelectionChangeEventArgs } from "@bentley/presentation-frontend";
// cSpell:ignore configurableui
import { UiEvent } from "@bentley/ui-core";
import { Backstage } from "../backstage/Backstage";
import { ContentViewManager } from "../content/ContentViewManager";
import { FrontstageManager } from "../frontstage/FrontstageManager";
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
  /** A Task has been activated. */
  TaskActivated = "taskactivated",
  /** The state of a Widget has changed. */
  WidgetStateChanged = "widgetstatechanged",
  /** A Workflow has been activated. */
  WorkflowActivated = "workflowactivated",
  /** The SelectionSet for the active IModelConnection has changed. */
  SelectionSetChanged = "selectionsetchanged",
  /** The list of settings providers registered with SettingsManager has changed. */
  SettingsProvidersChanged = "settingsproviderschanged",
  /** The current view state has changed (used by view undo/redo toolbar buttons). */
  ViewStateChanged = "viewstatechanged",
  /** The current object the reads and write UI Settings has changed. */
  UiSettingsChanged = "uisettingschanged",
}

/** SyncUi Event arguments. Contains a set of lower case event Ids.
 * @public
 */
export interface SyncUiEventArgs {
  eventIds: Set<string>;
}

/** SyncUi Event class.
 * @public
 */
export class SyncUiEvent extends UiEvent<SyncUiEventArgs> { }

/** This class is used to send eventIds to interested UI components so the component can determine if it needs
 * to refresh its display by calling setState on itself.
 * @public
 */
export class SyncUiEventDispatcher {
  private static _syncEventTimerId: number | undefined;
  private static _eventIds: Set<string>;
  private static _eventIdAdded = false;
  private static _syncUiEvent: SyncUiEvent;
  private static _timeoutPeriod = 100;
  private static _secondaryTimeoutPeriod = SyncUiEventDispatcher._timeoutPeriod / 2;
  private static _unregisterListenerFunc?: () => void;
  private static _unregisterListenerFuncs: Array<() => void> = [];
  private static initialized = false;

  /** @internal - used for testing only */
  /* istanbul ignore next */
  public static setTimeoutPeriod(period: number): void {
    SyncUiEventDispatcher._timeoutPeriod = period;
    SyncUiEventDispatcher._secondaryTimeoutPeriod = Math.floor(SyncUiEventDispatcher._timeoutPeriod / 2);
    if (SyncUiEventDispatcher._secondaryTimeoutPeriod < 1)
      SyncUiEventDispatcher._secondaryTimeoutPeriod = 1;
    if (SyncUiEventDispatcher._syncEventTimerId) {
      window.clearTimeout(SyncUiEventDispatcher._syncEventTimerId);
      SyncUiEventDispatcher._syncEventTimerId = undefined;
    }
    if (SyncUiEventDispatcher._eventIds)
      SyncUiEventDispatcher._eventIds.clear();

    SyncUiEventDispatcher._eventIdAdded = false;
  }

  /** Return set of event ids that will be sent to listeners/. */
  public static get syncEventIds(): Set<string> {
    if (!SyncUiEventDispatcher._eventIds)
      SyncUiEventDispatcher._eventIds = new Set<string>();

    return SyncUiEventDispatcher._eventIds;
  }

  /** Return SyncUiEvent so callers can register an event callback. */
  public static get onSyncUiEvent(): SyncUiEvent {
    if (!SyncUiEventDispatcher._syncUiEvent)
      SyncUiEventDispatcher._syncUiEvent = new SyncUiEvent();

    return SyncUiEventDispatcher._syncUiEvent;
  }

  /** Immediately trigger sync event processing. */
  public static dispatchImmediateSyncUiEvent(eventId: string): void {
    const eventIds = new Set<string>();
    eventIds.add(eventId.toLowerCase());
    SyncUiEventDispatcher.onSyncUiEvent.emit({ eventIds });
  }

  /** Save eventId in Set for processing. */
  public static dispatchSyncUiEvent(eventId: string): void {
    if (0 === SyncUiEventDispatcher._timeoutPeriod) {
      Logger.logInfo(UiFramework.loggerCategory(this), `[dispatchSyncUiEvent] not processed because _timeoutPeriod=0`);
      return;
    }

    SyncUiEventDispatcher.syncEventIds.add(eventId.toLowerCase());
    if (!SyncUiEventDispatcher._syncEventTimerId) {  // if there is not a timer active, create one
      SyncUiEventDispatcher._syncEventTimerId = window.setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._timeoutPeriod);
    } else {
      SyncUiEventDispatcher._eventIdAdded = true;
    }
  }

  /** Save multiple eventIds in Set for processing. */
  public static dispatchSyncUiEvents(eventIds: string[]): void {
    // istanbul ignore if
    if (0 === SyncUiEventDispatcher._timeoutPeriod) {
      Logger.logInfo(UiFramework.loggerCategory(this), `[dispatchSyncUiEvents] not processed because _timeoutPeriod=0`);
      return;
    }

    eventIds.forEach((id) => SyncUiEventDispatcher.syncEventIds.add(id.toLowerCase()));
    // istanbul ignore else
    if (!SyncUiEventDispatcher._syncEventTimerId) {  // if there is not a timer active, create one
      SyncUiEventDispatcher._syncEventTimerId = window.setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._timeoutPeriod);
    } else {
      SyncUiEventDispatcher._eventIdAdded = true;
    }
  }

  /** Trigger registered event processing when timer has expired and no addition eventId are added. */
  private static checkForAdditionalIds() {
    /* istanbul ignore else */
    if (!SyncUiEventDispatcher._eventIdAdded) {
      // istanbul ignore else
      if (SyncUiEventDispatcher._syncEventTimerId) {
        window.clearTimeout(SyncUiEventDispatcher._syncEventTimerId);
        SyncUiEventDispatcher._syncEventTimerId = undefined;
      } else {
        Logger.logError(UiFramework.loggerCategory(this), "SyncUiEventDispatcher.checkForAdditionalIds - expected _syncEventTimerId to be defined");
      }
      SyncUiEventDispatcher._eventIdAdded = false;
      // istanbul ignore else
      if (SyncUiEventDispatcher.syncEventIds.size > 0) {
        const eventIds = new Set<string>();
        SyncUiEventDispatcher.syncEventIds.forEach((value) => eventIds.add(value));
        SyncUiEventDispatcher._eventIds.clear();
        SyncUiEventDispatcher.onSyncUiEvent.emit({ eventIds });
      }
      return;
    }

    // istanbul ignore next
    if (SyncUiEventDispatcher._syncEventTimerId) {
      window.clearTimeout(SyncUiEventDispatcher._syncEventTimerId);
      SyncUiEventDispatcher._syncEventTimerId = undefined;
    }
    // istanbul ignore next
    SyncUiEventDispatcher._eventIdAdded = false;
    // if events have been added before the initial timer expired wait half that time to see if events are still being added.
    // istanbul ignore next
    SyncUiEventDispatcher._syncEventTimerId = window.setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._secondaryTimeoutPeriod);
  }

  /** Checks to see if an eventId of interest is contained in the set of eventIds */
  public static hasEventOfInterest(eventIds: Set<string>, idsOfInterest: string[]) {
    /* istanbul ignore else */
    if ((idsOfInterest.length > 0) && idsOfInterest.some((value: string): boolean => eventIds.has(value.toLowerCase())))
      return true;
    return false;
  }

  // istanbul ignore next
  private static _dispatchViewChange() {
    SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ViewStateChanged);
  }

  /** Initializes the Monitoring of Events that trigger dispatching sync events */
  public static initialize() {
    // clear any registered listeners - this should only be encountered in unit test scenarios
    this._unregisterListenerFuncs.forEach((unregisterListenerFunc)=>unregisterListenerFunc());

    this._unregisterListenerFuncs.push(FrontstageManager.onContentControlActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ContentControlActivated);
    }));

    this._unregisterListenerFuncs.push(FrontstageManager.onContentLayoutActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ContentLayoutActivated);
    }));

    this._unregisterListenerFuncs.push(FrontstageManager.onFrontstageActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.FrontstageActivating);
    }));

    this._unregisterListenerFuncs.push(FrontstageManager.onFrontstageReadyEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.FrontstageReady);
    }));

    this._unregisterListenerFuncs.push(FrontstageManager.onModalFrontstageChangedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ModalFrontstageChanged);
    }));

    this._unregisterListenerFuncs.push(FrontstageManager.onNavigationAidActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.NavigationAidActivated);
    }));

    this._unregisterListenerFuncs.push(FrontstageManager.onToolActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ToolActivated);
    }));

    this._unregisterListenerFuncs.push(FrontstageManager.onWidgetStateChangedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.WidgetStateChanged);
    }));

    this._unregisterListenerFuncs.push(Backstage.onBackstageEvent.addListener(() => { // eslint-disable-line deprecation/deprecation
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.BackstageEvent);
    }));

    this._unregisterListenerFuncs.push(WorkflowManager.onTaskActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.TaskActivated);
    }));

    this._unregisterListenerFuncs.push(WorkflowManager.onWorkflowActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.WorkflowActivated);
    }));

    this._unregisterListenerFuncs.push(ContentViewManager.onActiveContentChangedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ActiveContentChanged);
    }));

    // istanbul ignore else
    if (IModelApp && IModelApp.viewManager) {
      this._unregisterListenerFuncs.push(IModelApp.viewManager.onSelectedViewportChanged.addListener((args: SelectedViewportChangedArgs) => {
        SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ActiveViewportChanged);

        // if this is the first view being opened up start the default tool so tool admin is happy.
        if (undefined === args.previous) {
          IModelApp.toolAdmin.startDefaultTool();
        } else {
          // istanbul ignore next
          if (args.previous.onViewChanged && typeof args.previous.onViewChanged.removeListener === "function")  // not set during unit test
            args.previous.onViewChanged.removeListener(SyncUiEventDispatcher._dispatchViewChange);
        }
        // istanbul ignore next
        if (args.current) {
          if (args.current.onViewChanged && typeof args.current.onViewChanged.addListener === "function") // not set during unit test
            args.current.onViewChanged.addListener(SyncUiEventDispatcher._dispatchViewChange);
        }
      }));
    }
  }

  private static selectionChangedHandler(_ev: SelectionSetEvent) {
    SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.SelectionSetChanged);
  }

  /** This should be called by IModelApp when the active IModelConnection is closed. */
  public static clearConnectionEvents(iModelConnection: IModelConnection) {
    iModelConnection.selectionSet.onChanged.removeListener(SyncUiEventDispatcher.selectionChangedHandler);

    if (SyncUiEventDispatcher._unregisterListenerFunc)
      SyncUiEventDispatcher._unregisterListenerFunc();

    UiFramework.setActiveIModelId("");
  }

  /** This should be called by IModelApp when the active IModelConnection is established. */
  public static initializeConnectionEvents(iModelConnection: IModelConnection) {
    iModelConnection.selectionSet.onChanged.removeListener(SyncUiEventDispatcher.selectionChangedHandler);
    iModelConnection.selectionSet.onChanged.addListener(SyncUiEventDispatcher.selectionChangedHandler);
    (iModelConnection.iModelId) ? UiFramework.setActiveIModelId(iModelConnection.iModelId) : /* istanbul ignore next */ "";
    if (SyncUiEventDispatcher._unregisterListenerFunc)
      SyncUiEventDispatcher._unregisterListenerFunc();

    // listen for changes from presentation rules selection manager (this is done once an iModelConnection is available to ensure Presentation.selection is valid)
    SyncUiEventDispatcher._unregisterListenerFunc = Presentation.selection.selectionChange.addListener((args: SelectionChangeEventArgs, provider: ISelectionProvider) => {
      // istanbul ignore if
      if (args.level !== 0) {
        // don't need to handle sub-selections
        return;
      }
      const selection = provider.getSelection(args.imodel, args.level);
      const numSelected = getInstancesCount(selection);
      UiFramework.dispatchActionToStore(SessionStateActionId.SetNumItemsSelected, numSelected);
    });

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
  }

}

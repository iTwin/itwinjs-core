/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SyncUi */

// cSpell:ignore configurableui
import { UiEvent } from "@bentley/ui-core";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { Backstage } from "../backstage/Backstage";
import { WorkflowManager } from "../workflow/Workflow";
import { ContentViewManager } from "../content/ContentViewManager";
import { SessionStateActionId } from "../SessionState";
import { UiFramework, PresentationSelectionScope } from "../UiFramework";
import { IModelConnection, SelectEventType, IModelApp, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { Presentation, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/presentation-frontend";
import { SelectionScope, getInstancesCount } from "@bentley/presentation-common";

// cSpell:ignore activecontentchanged, activitymessageupdated, activitymessagecancelled, backstagecloseevent, contentlayoutactivated, contentcontrolactivated,
// cSpell:ignore elementtooltipchanged, frontstageactivated, inputfieldmessageadded, inputfieldmessageremoved, modalfrontstagechanged, modaldialogchanged
// cSpell:ignore navigationaidactivated, notificationmessageadded, toolactivated, taskactivated, widgetstatechanged, workflowactivated frontstageactivating
// cSpell:ignore frontstageready activeviewportchanged selectionsetchanged presentationselectionchanged

/** Event Id used to sync UI components. Typically used to refresh visibility or enable state of control.
 * @public
 */
export enum SyncUiEventId {
  /** The active content as maintained by the ContentViewManager has changed. */
  ActiveContentChanged = "activecontentchanged",
  /** The active view maintained by the ViewManager has changed. */
  ActiveViewportChanged = "activeviewportchanged",
  /** Backstage has been closed. */
  BackstageCloseEvent = "backstagecloseevent",
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

/** SyncUi Event Dispatcher class. This class is used to send eventIds to interested Ui components so the component can determine if it needs
 * to refresh its display by calling setState on itself.
 * @public
 */
export class SyncUiEventDispatcher {
  private static _syncEventTimerId: number | undefined;
  private static _eventIds: Set<string>;
  private static _eventIdAdded: boolean = false;
  private static _syncUiEvent: SyncUiEvent;
  private static _timeoutPeriod: number = 200;
  private static _unregisterListenerFunc?: () => void;

  /** @internal - used for testing only */
  public static setTimeoutPeriod(period: number): void {
    SyncUiEventDispatcher._timeoutPeriod = period;
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
    SyncUiEventDispatcher.syncEventIds.add(eventId.toLowerCase());
    if (!SyncUiEventDispatcher._syncEventTimerId) {  // if there is not a timer active, create one
      SyncUiEventDispatcher._syncEventTimerId = window.setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._timeoutPeriod);
    } else {
      SyncUiEventDispatcher._eventIdAdded = true;
    }
  }

  /** Save multiple eventIds in Set for processing. */
  public static dispatchSyncUiEvents(eventIds: string[]): void {
    eventIds.forEach((id) => SyncUiEventDispatcher.syncEventIds.add(id.toLowerCase()));
    if (!SyncUiEventDispatcher._syncEventTimerId) {  // if there is not a timer active, create one
      SyncUiEventDispatcher._syncEventTimerId = window.setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._timeoutPeriod);
    } else {
      SyncUiEventDispatcher._eventIdAdded = true;
    }
  }

  /** Trigger registered event processing when timer has expired and no addition eventId are added. */
  private static checkForAdditionalIds() {
    /* istanbul ignore else */
    if (!SyncUiEventDispatcher._eventIdAdded && SyncUiEventDispatcher._syncEventTimerId) {
      if (SyncUiEventDispatcher._syncEventTimerId) window.clearTimeout(SyncUiEventDispatcher._syncEventTimerId);
      SyncUiEventDispatcher._syncEventTimerId = undefined;
      SyncUiEventDispatcher._eventIdAdded = false;
      if (SyncUiEventDispatcher.syncEventIds.size > 0) {
        const eventIds = new Set<string>();
        SyncUiEventDispatcher.syncEventIds.forEach((value) => eventIds.add(value));
        SyncUiEventDispatcher.syncEventIds.clear();
        SyncUiEventDispatcher.onSyncUiEvent.emit({ eventIds });
      }
      return;
    }

    /* istanbul ignore else */
    if (SyncUiEventDispatcher._syncEventTimerId) clearTimeout(SyncUiEventDispatcher._syncEventTimerId);
    SyncUiEventDispatcher._eventIdAdded = false;
    // if events have been added before the initial timer expired wait half that time to see if events are still being added.
    SyncUiEventDispatcher._syncEventTimerId = window.setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._timeoutPeriod / 2);
  }

  /** Checks to see if an eventId of interest is contained in the set of eventIds */
  public static hasEventOfInterest(eventIds: Set<string>, idsOfInterest: string[]) {
    /* istanbul ignore else */
    if ((idsOfInterest.length > 0) && idsOfInterest.some((value: string): boolean => eventIds.has(value)))
      return true;
    return false;
  }

  /** Initializes the Monitoring of Events that trigger dispatching sync events */
  public static initialize() {
    FrontstageManager.onContentControlActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ContentControlActivated);
    });

    FrontstageManager.onContentLayoutActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ContentLayoutActivated);
    });

    FrontstageManager.onFrontstageActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.FrontstageActivating);
    });

    FrontstageManager.onFrontstageReadyEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.FrontstageReady);
    });

    FrontstageManager.onModalFrontstageChangedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ModalFrontstageChanged);
    });

    FrontstageManager.onNavigationAidActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.NavigationAidActivated);
    });

    FrontstageManager.onToolActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ToolActivated);
    });

    FrontstageManager.onWidgetStateChangedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.WidgetStateChanged);
    });

    Backstage.onBackstageCloseEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.BackstageCloseEvent);
    });

    WorkflowManager.onTaskActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.TaskActivated);
    });

    WorkflowManager.onWorkflowActivatedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.WorkflowActivated);
    });

    ContentViewManager.onActiveContentChangedEvent.addListener(() => {
      SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ActiveContentChanged);
    });

    if (IModelApp && IModelApp.viewManager) {
      IModelApp.viewManager.onSelectedViewportChanged.addListener((args: SelectedViewportChangedArgs) => {
        SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.ActiveViewportChanged);

        // if this is the first view being opened up start the default tool so tool admin is happy.
        if (undefined === args.previous)
          IModelApp.toolAdmin.startDefaultTool();
      });
    }
  }

  private static selectionChangedHandler(_iModelConnection: IModelConnection, _evType: SelectEventType, _ids?: Set<string>) {
    SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.SelectionSetChanged);
  }

  public static clearConnectionEvents(iModelConnection: IModelConnection) {
    iModelConnection.selectionSet.onChanged.removeListener(SyncUiEventDispatcher.selectionChangedHandler);
  }

  public static initializeConnectionEvents(iModelConnection: IModelConnection) {
    iModelConnection.selectionSet.onChanged.removeListener(SyncUiEventDispatcher.selectionChangedHandler);
    iModelConnection.selectionSet.onChanged.addListener(SyncUiEventDispatcher.selectionChangedHandler);

    if (SyncUiEventDispatcher._unregisterListenerFunc)
      SyncUiEventDispatcher._unregisterListenerFunc();

    // listen for changes from presentation rules selection manager (this is done once an iModelConnection is available to ensure Presentation.selection is valid)
    SyncUiEventDispatcher._unregisterListenerFunc = Presentation.selection.selectionChange.addListener((args: SelectionChangeEventArgs, provider: ISelectionProvider) => {
      if (args.level !== 0) {
        // don't need to handle sub-selections
        return;
      }
      const selection = provider.getSelection(args.imodel, args.level);
      const numSelected = getInstancesCount(selection);
      UiFramework.dispatchActionToStore(SessionStateActionId.SetNumItemsSelected, numSelected);
    });

    Presentation.selection.scopes.getSelectionScopes(iModelConnection).then((availableScopes: SelectionScope[]) => { // tslint:disable-line:no-floating-promises
      if (availableScopes) {
        const presentationScopes: PresentationSelectionScope[] = [];
        availableScopes.map((scope) => presentationScopes.push(scope));
        UiFramework.dispatchActionToStore(SessionStateActionId.SetAvailableSelectionScopes, presentationScopes);
      }
    });

    const activeSelectionScope = Presentation.selection.scopes.activeScope;
    if (activeSelectionScope) {
      if (typeof (activeSelectionScope) === "object") {
        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, (activeSelectionScope as SelectionScope).id);
      } else {
        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, activeSelectionScope);
      }
    }
  }

}

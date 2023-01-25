/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SyncUi
 */

import { UiSyncEvent, UiSyncEventArgs } from "@itwin/appui-abstract";
import { IModelConnection } from "@itwin/core-frontend";
// cSpell:ignore configurableui
import { InternalSyncUiEventDispatcher as internal } from "./InternalSyncUiEventDispatcher";

/** SyncUi Event arguments. Contains a set of lower case event Ids.
 * @public @deprecated in 3.0. Use UiSyncEventArgs in appui-abstract instead
 */
export type SyncUiEventArgs = UiSyncEventArgs;

/** SyncUi Event class.
 * @public @deprecated in 3.0. Use UiSyncEvent in appui-abstract instead
 */
export type SyncUiEvent = UiSyncEvent;

/** This class is used to send eventIds to interested UI components so the component can determine if it needs
 * to refresh its display by calling setState on itself.
 * @public
 * @deprecated in 3.6. Use `UiFramework.events` property.
 */
export class SyncUiEventDispatcher {
  /** Initializes the Monitoring of Events that trigger dispatching sync events.
   * @deprecated in 3.6. This is called internally.
  */
  public static initialize() {
    return internal.initialize();
  }

  /** @internal - used for testing only */
  /* istanbul ignore next */
  public static setTimeoutPeriod(period: number): void {
    return internal.setTimeoutPeriod(period);
  }

  /** Return set of event ids that will be sent to listeners/. */
  public static get syncEventIds(): Set<string> {
    return internal.syncEventIds;
  }

  /** Return SyncUiEvent so callers can register an event callback. */
  // eslint-disable-next-line deprecation/deprecation
  public static get onSyncUiEvent(): SyncUiEvent {
    return internal.onSyncUiEvent;
  }

  /** Immediately trigger sync event processing. */
  public static dispatchImmediateSyncUiEvent(eventId: string): void {
    return internal.dispatchImmediateSyncUiEvent(eventId);
  }

  /** Save eventId in Set for processing. */
  public static dispatchSyncUiEvent(eventId: string): void {
    return internal.dispatchSyncUiEvent(eventId);
  }

  /** Save multiple eventIds in Set for processing. */
  public static dispatchSyncUiEvents(eventIds: string[]): void {
    return internal.dispatchSyncUiEvents(eventIds);
  }

  /** Checks to see if an eventId of interest is contained in the set of eventIds */
  public static hasEventOfInterest(eventIds: Set<string>, idsOfInterest: string[]) {
    return internal.hasEventOfInterest(eventIds, idsOfInterest);
  }

  /** This should be called by IModelApp when the active IModelConnection is closed. */
  public static clearConnectionEvents(iModelConnection: IModelConnection) {
    return internal.clearConnectionEvents(iModelConnection);
  }

  /** This should be called by IModelApp when the active IModelConnection is established. */
  public static initializeConnectionEvents(iModelConnection: IModelConnection) {
    return internal.initializeConnectionEvents(iModelConnection);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { UiEvent } from "@bentley/ui-core";

/** SyncUi Event arguments. Contains a set of lower case event Ids.
 */
export interface SyncUiEventArgs {
  eventIds: Set<string>;
}

/** SyncUi Event class.
 */
export class SyncUiEvent extends UiEvent<SyncUiEventArgs> { }

/** SyncUi Event Dispatcher class. This class is used to send eventIds to interested Ui components so the component can determine if it needs
 * to refresh its display by calling setState on itself.
 */
export class SyncUiEventDispatcher {
  private static _syncEventTimer: NodeJS.Timer | undefined;
  private static _eventIds: Set<string>;
  private static _eventIdAdded: boolean = false;
  private static _syncUiEvent: SyncUiEvent;
  private static _timeoutPeriod: number = 500;

  /** @hidden - used for testing only */
  public static setTimeoutPeriod(period: number): void {
    SyncUiEventDispatcher._timeoutPeriod = period;
  }

  /** Return SyncUiEvent so callers can register an event callback. */
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

  // Save eventId in Set for processing.
  public static dispatchSyncUiEvent(eventId: string): void {
    SyncUiEventDispatcher.syncEventIds.add(eventId.toLowerCase());
    SyncUiEventDispatcher._eventIdAdded = true;
    if (!SyncUiEventDispatcher._syncEventTimer) {  // if there is not a timer active, create one
      SyncUiEventDispatcher._syncEventTimer = setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._timeoutPeriod);
    }
  }

  // Save multiple eventIds in Set for processing.
  public static dispatchSyncUiEvents(eventIds: string[]): void {
    eventIds.forEach((id) => SyncUiEventDispatcher.syncEventIds.add(id.toLowerCase()));
    if (!SyncUiEventDispatcher._syncEventTimer) {  // if there is not a timer active, create one
      SyncUiEventDispatcher._syncEventTimer = setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._timeoutPeriod);
    } else {
      SyncUiEventDispatcher._eventIdAdded = true;
    }
  }

  // Trigger registered event processing when timer has expired and no addition eventId are added.
  private static checkForAdditionalIds() {
    if (!SyncUiEventDispatcher._eventIdAdded && SyncUiEventDispatcher._syncEventTimer) {
      if (SyncUiEventDispatcher._syncEventTimer) clearTimeout(SyncUiEventDispatcher._syncEventTimer);
      SyncUiEventDispatcher._syncEventTimer = undefined;
      SyncUiEventDispatcher._eventIdAdded = false;
      SyncUiEventDispatcher.onSyncUiEvent.emit({ eventIds: SyncUiEventDispatcher.syncEventIds });
      return;
    }

    if (SyncUiEventDispatcher._syncEventTimer) clearTimeout(SyncUiEventDispatcher._syncEventTimer);
    SyncUiEventDispatcher._eventIdAdded = false;
    SyncUiEventDispatcher._syncEventTimer = setTimeout(SyncUiEventDispatcher.checkForAdditionalIds, SyncUiEventDispatcher._timeoutPeriod);
  }
}

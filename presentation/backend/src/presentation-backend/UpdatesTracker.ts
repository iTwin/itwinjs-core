/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IDisposable } from "@bentley/bentleyjs-core";
import { EventSink } from "@bentley/imodeljs-backend";
import { PresentationRpcEvents, PresentationRpcInterface } from "@bentley/presentation-common";
import { NativePlatformDefinition } from "./NativePlatform";

/**
 * Configuration properties for [[UpdatesTracker]].
 * @internal
 */
export interface UpdatesTrackerProps {
  nativePlatformGetter: () => NativePlatformDefinition;
  eventSink: EventSink;
  pollInterval: number;
}

/**
 * An updates handler which polls native platform for update records
 * and emits an event to the frontend if any are found.
 *
 * @internal
 */
export class UpdatesTracker implements IDisposable {
  private _getNativePlatform: () => NativePlatformDefinition;
  private _eventSink: EventSink;
  private _intervalHandle: any;

  private constructor(props: UpdatesTrackerProps) {
    this._getNativePlatform = props.nativePlatformGetter;
    this._eventSink = props.eventSink;
    this._intervalHandle = setInterval(this.onInterval.bind(this), props.pollInterval);
  }

  public static create(props: UpdatesTrackerProps): UpdatesTracker { return new UpdatesTracker(props); }

  public dispose(): void {
    clearInterval(this._intervalHandle);
  }

  private onInterval() {
    const updateInfo = this._getNativePlatform().getUpdateInfo();
    if (updateInfo.result)
      this._eventSink.emit(PresentationRpcInterface.interfaceName, PresentationRpcEvents.Update, updateInfo.result);
  }
}

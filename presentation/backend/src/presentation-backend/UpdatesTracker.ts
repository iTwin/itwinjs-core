/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IDisposable } from "@bentley/bentleyjs-core";
import { EventSink, IModelDb } from "@bentley/imodeljs-backend";
import { PresentationRpcEvents, PresentationRpcInterface, UpdateInfoJSON } from "@bentley/presentation-common";
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

  public static create(props: UpdatesTrackerProps) { return new UpdatesTracker(props); }

  public dispose() {
    clearInterval(this._intervalHandle);
  }

  private onInterval() {
    const response = this._getNativePlatform().getUpdateInfo();
    const info = parseUpdateInfo(response.result);
    if (info) {
      this._eventSink.emit(PresentationRpcInterface.interfaceName, PresentationRpcEvents.Update, info);
    }
  }
}

const parseUpdateInfo = (info: UpdateInfoJSON | undefined) => {
  if (info === undefined)
    return undefined;

  const parsedInfo: UpdateInfoJSON = {};
  for (const fileName in info) {
    // istanbul ignore if
    if (!info.hasOwnProperty(fileName))
      continue;

    const imodelDb = IModelDb.findByFilename(fileName);
    if (!imodelDb)
      continue;

    parsedInfo[imodelDb.getRpcProps().key] = info[fileName];
  }
  return Object.keys(parsedInfo).length > 0 ? parsedInfo : undefined;
};

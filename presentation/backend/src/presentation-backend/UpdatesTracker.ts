/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IDisposable, Logger } from "@itwin/core-bentley";
import { IModelDb, IpcHost } from "@itwin/core-backend";
import { PresentationIpcEvents, UpdateInfoJSON } from "@itwin/presentation-common";
import { PresentationBackendLoggerCategory } from "./BackendLoggerCategory";
import { NativePlatformDefinition } from "./NativePlatform";

/**
 * Configuration properties for [[UpdatesTracker]].
 * @internal
 */
export interface UpdatesTrackerProps {
  nativePlatformGetter: () => NativePlatformDefinition;
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
  private _intervalHandle: any;

  private constructor(props: UpdatesTrackerProps) {
    this._getNativePlatform = props.nativePlatformGetter;
    this._intervalHandle = setInterval(this.onInterval.bind(this), props.pollInterval);
  }

  public static create(props: UpdatesTrackerProps) { return new UpdatesTracker(props); }

  public dispose() {
    clearInterval(this._intervalHandle);
  }

  private onInterval() {
    const response = this._getNativePlatform().getUpdateInfo();
    const info = parseUpdateInfo(response.result);
    if (info)
      IpcHost.send(PresentationIpcEvents.Update, info);
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
    if (!imodelDb) {
      Logger.logError(PresentationBackendLoggerCategory.PresentationManager, `Update records IModelDb not found with path ${fileName}`);
      continue;
    }

    parsedInfo[imodelDb.getRpcProps().key] = info[fileName];
  }
  return Object.keys(parsedInfo).length > 0 ? parsedInfo : undefined;
};

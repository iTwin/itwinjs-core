/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelTokenProps } from "../IModel";

/** Represents a queued event retrieved from NativeAppRpcInterface.fetchEvent.
 * @internal
 */
export interface QueuedEvent {
  eventId: number; // stable auto-incremented id used to determine order of events
  namespace: string; // namespace for the event
  eventName: string; // name of the event
  data: any; // this will be serialized to json
}

/** NativeAppRpcInterface supplies Rpc functionality specific to native apps.
 * A "native app" is an iModel.js application in which a one-to-one relationship exists between the frontend and backend process. Both processes execute on the same device, which can
 * enable offline workflows. Such an app can target a specific platform - e.g., Electron, iOS, Android.
 * By contrast, browser-based iModel.js applications are platform-agnostic, support multiple simultaneous frontend connections, and require a network connection.
 * @internal
 */
export abstract class NativeAppRpcInterface extends RpcInterface {
  /** Returns the IModelWriteRpcInterface client instance for the frontend. */
  public static getClient(): NativeAppRpcInterface { return RpcManager.getClientForInterface(NativeAppRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "NativeAppRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "0.1.0";

  /*===========================================================================================
      NOTE: Any add/remove/change to the methods below requires an update of the interface version.
      NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/

  /** Fetch a list of queue events for the specified iModel from the backend, up to the specified maximum number of events.
   * The order of the events in the returned array matches the order in which the events occurred.
   * @param _iModelToken Identifies the iModel
   * @param _maxToFetch The maximum number of events to return. If this is less than or equal to zero, all queued events will be returned.
   * @returns Up to _maxToFetch queued events.
   */
  public async fetchEvents(_iModelToken: IModelTokenProps, _maxToFetch: number): Promise<QueuedEvent[]> { return this.forward(arguments); }
}

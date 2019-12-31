/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelTokenProps } from "../IModel";

/** Represent queued event
 * @internal
 */
export interface QueuedEvent {
  eventId: number; // stable id use as timestamp to determine order of events
  namespace: string; // namespace for the event
  eventName: string; // name of the event
  data: any; // this will serialized to json
}
/** The RPC interface is used by native apps (desktop/mobile) which target disconnected mode.
 * This interface is not normally used directly. See NativeApp for higher-level and more convenient API for accessing these services from frontend.
 * @internal
 */
export abstract class EventSourceRpcInterface extends RpcInterface {
  /** Returns the IModelWriteRpcInterface client instance for the frontend. */
  public static getClient(): EventSourceRpcInterface { return RpcManager.getClientForInterface(EventSourceRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "EventSourceRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "0.1.0";

  /*===========================================================================================
      NOTE: Any add/remove/change to the methods below requires an update of the interface version.
      NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public async fetch(_iModelToken: IModelTokenProps, _limit: number): Promise<QueuedEvent[]> { return this.forward(arguments); }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BeEvent, BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";

/** @alpha */
export type RpcPushMessageListener<T> = (message: T) => void;

/** Defines a transport for push messages.
 *  @alpha
 */
export abstract class RpcPushTransport {
  public onMessage?: (channelId: string, messageData: any) => void;
}

/** Defines a source of push messages.
 *  @alpha
 */
export class RpcPushService {
  /** The push service for the dedicated backend (for example, an electron or mobile app). */
  public static dedicated = new RpcPushService("dedicated");

  public readonly name: string;

  public constructor(name: string) {
    this.name = name;
  }
}

/** Defines a named stream of push messages.
 *  @alpha
 */
export class RpcPushChannel<T> {
  /** @internal */
  public static enabled = false;

  private static _channels: Map<string, RpcPushChannel<any>> = new Map();

  public static setup(transport: RpcPushTransport) {
    transport.onMessage = RpcPushChannel.notifySubscribers.bind(RpcPushChannel);
    RpcPushChannel.enabled = true;
  }

  private static notifySubscribers(channelId: string, messageData: any) {
    const channel = this._channels.get(channelId);
    if (!channel) {
      return;
    }

    for (const subscriber of channel._subscribers) {
      subscriber.onMessage.raiseEvent(messageData);
    }
  }

  private _subscribers: RpcPushSubscription<T>[] = [];
  public readonly name: string;
  public readonly service: RpcPushService;
  public get id() { return `${this.service.name}-${this.name}`; }
  public get enabled() { return RpcPushChannel.enabled; }

  public subscribe(): RpcPushSubscription<T> {
    const subscription = new RpcPushSubscription(this);
    this._subscribers.push(subscription);
    return subscription;
  }

  public constructor(name: string, service = RpcPushService.dedicated) {
    this.name = name;
    this.service = service;

    if (RpcPushChannel._channels.has(this.id)) {
      throw new IModelError(BentleyStatus.ERROR, "Channel already exists.");
    }

    RpcPushChannel._channels.set(this.id, this);
  }

  /** Delete the specified channel.
   * Temporary, pending more extensive changes to event system - to be replaced with a `dispose()` method.
   * @internal
   */
  public static delete(name: string, service = RpcPushService.dedicated): void {
    const id = `${service.name}-${name}`;
    RpcPushChannel._channels.delete(id);
  }
}

/** Receives push messages from the backend.
 *  @alpha
 */
export class RpcPushSubscription<T> {
  public readonly channel: RpcPushChannel<T>;
  public readonly onMessage = new BeEvent<RpcPushMessageListener<T>>();

  /** @internal */
  public constructor(channel: RpcPushChannel<T>) {
    this.channel = channel;
  }
}

/** Sends push messages to the frontend.
 *  @alpha
 */
export abstract class RpcPushConnection<T> {
  public static for<T>(_channel: RpcPushChannel<T>, _client: unknown = undefined): RpcPushConnection<T> {
    throw new IModelError(BentleyStatus.ERROR, "Not implemented.");
  }

  public readonly channel: RpcPushChannel<T>;
  public readonly client: unknown;

  public abstract send(messageData: T): Promise<void>;

  protected constructor(channel: RpcPushChannel<T>, client: unknown) {
    this.channel = channel;
    this.client = client;
  }
}

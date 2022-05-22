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

import { assert, BeEvent, BentleyStatus } from "@itwin/core-bentley";
import { IModelError } from "../../IModelError";

/** @internal */
export type RpcPushMessageListener<T> = (message: T) => void;

/** Defines a transport for push messages.
 *  @internal
 */
export abstract class RpcPushTransport {
  public onMessage?: (channelId: string, messageData: any) => void;
}

/** Defines a source of push messages.
 *  @internal
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
 *  @internal
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
    if (!channel)
      return;

    for (const subscriber of channel._subscribers)
      subscriber.onMessage.raiseEvent(messageData);
  }

  private _subscribers: RpcPushSubscription<T>[] = [];
  public readonly name: string;
  public readonly service: RpcPushService;
  public get id() { return RpcPushChannel.formatId(this.name, this.service); }
  public get enabled() { return RpcPushChannel.enabled; }

  public subscribe(): RpcPushSubscription<T> {
    const subscription = new RpcPushSubscription(this);
    this._subscribers.push(subscription);
    return subscription;
  }

  private static formatId(name: string, service: RpcPushService): string {
    return `${service.name}-${name}`;
  }

  private constructor(name: string, service: RpcPushService) {
    this.name = name;
    this.service = service;
  }

  /** Creates a new RpcPushChannel.
   * @throws IModelError if a channel with the specified name and service already exist.
   */
  public static create<T>(name: string, service = RpcPushService.dedicated): RpcPushChannel<T> {
    return this.get<T>(name, service, false);
  }

  /** Obtains an RpcPushChannel, creating it if one with the specified name and service does not already exists. */
  public static obtain<T>(name: string, service = RpcPushService.dedicated): RpcPushChannel<T> {
    return this.get<T>(name, service, true);
  }

  private static get<T>(name: string, service: RpcPushService, reuseExisting: boolean): RpcPushChannel<T> {
    const id = this.formatId(name, service);
    let channel = this._channels.get(id);
    if (channel) {
      if (!reuseExisting)
        throw new IModelError(BentleyStatus.ERROR, `Channel "${id}" already exists.`);

      ++channel._refCount;
      return channel;
    }

    channel = new RpcPushChannel(name, service);
    this._channels.set(id, channel);
    return channel;
  }

  private _refCount = 1;
  public dispose(): void {
    if (this.isDisposed)
      return;

    assert(this._refCount > 0);
    if (--this._refCount === 0) {
      RpcPushChannel._channels.delete(this.id);
      this._subscribers.length = 0;
    }
  }

  public get isDisposed(): boolean {
    return 0 === this._refCount;
  }
}

/** Receives push messages from the backend.
 *  @internal
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
 *  @internal
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

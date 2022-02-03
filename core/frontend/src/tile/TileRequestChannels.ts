/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { IpcApp } from "../IpcApp";
import type { IModelConnection } from "../IModelConnection";
import type {
  IModelTile, TileRequest} from "./internal";
import { IModelTileRequestChannels, TileRequestChannel, TileRequestChannelStatistics,
} from "./internal";

/** For an [[IpcApp]], allows backend element graphics requests in progress to be canceled. */
class ElementGraphicsChannel extends TileRequestChannel {
  private readonly _canceled = new Map<IModelConnection, string[]>();

  public override onActiveRequestCanceled(request: TileRequest): void {
    const imodel = request.tile.tree.iModel;
    let ids = this._canceled.get(imodel);
    if (!ids)
      this._canceled.set(imodel, ids = []);

    ids.push(request.tile.contentId);
  }

  public override processCancellations(): void {
    for (const [imodel, requestIds] of this._canceled) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      IpcApp.callIpcHost("cancelElementGraphicsRequests", imodel.key, requestIds);
      this._statistics.totalAbortedRequests += requestIds.length;
    }

    this._canceled.clear();
  }

  public override onIModelClosed(imodel: IModelConnection): void {
    this._canceled.delete(imodel);
  }
}

/** A set of named [[TileRequestChannel]]s via which content for [[Tile]]s can be requested.
 * @see [[TileAdmin.channels]] for the channels configured for use with the iTwin.js display system.
 * @see [[TileRequestChannels.getForHttp]] for the most typical way of obtaining or registering a channel.
 * @public
 */
export class TileRequestChannels {
  /** @internal */
  public readonly iModelChannels: IModelTileRequestChannels;
  /** The channel over which [[TileAdmin.requestElementGraphics]] executes. If you implement a [[TiledGraphicsProvider]] or [[TileTree]] that obtains its
   * content from `requestElementGraphics`, use this channel.
   */
  public readonly elementGraphicsRpc: TileRequestChannel;
  /** The maximum number of active requests for a channel that uses HTTP to request content. */
  public readonly httpConcurrency = 6;
  private _rpcConcurrency: number;
  private readonly _channels = new Map<string, TileRequestChannel>();

  /** `rpcConcurrency` is defined if [[IpcApp.isValid]]; otherwise RPC requests are made over HTTP and use the same limits.
   * @internal
   */
  public constructor(rpcConcurrency: number | undefined, cacheMetadata: boolean) {
    this._rpcConcurrency = rpcConcurrency ?? this.httpConcurrency;

    const elementGraphicsChannelName = "itwinjs-elem-rpc";
    if (undefined !== rpcConcurrency)
      this.elementGraphicsRpc = new ElementGraphicsChannel(elementGraphicsChannelName, rpcConcurrency);
    else
      this.elementGraphicsRpc = new TileRequestChannel(elementGraphicsChannelName, this.rpcConcurrency);

    this.add(this.elementGraphicsRpc);

    this.iModelChannels = new IModelTileRequestChannels({
      concurrency: this.rpcConcurrency,
      usesHttp: undefined === rpcConcurrency,
      cacheMetadata,
    });

    for (const channel of this.iModelChannels)
      this.add(channel);
  }

  /** Lazily called by [[TileAdmin]] once it can determine whether a cloud storage cache is configured.
   * @internal
   */
  public enableCloudStorageCache(): void {
    this.add(this.iModelChannels.enableCloudStorageCache(this.httpConcurrency));
  }

  /** The number of registered channels. */
  public get size(): number {
    return this._channels.size;
  }

  /** Look up a registered channel by its name. */
  public get(name: string): TileRequestChannel | undefined {
    return this._channels.get(name);
  }

  /** Return whether the specified channel has been registered. Primarily for debugging. */
  public has(channel: TileRequestChannel): boolean {
    const existing = this.get(channel.name);
    return existing !== undefined && existing === channel;
  }

  /** Add a new channel.
   * @throws Error if a channel by the same name has already been registered.
   */
  public add(channel: TileRequestChannel): void {
    if (this.get(channel.name))
      throw new Error(`Tile request channel ${channel.name} is already registered.`);

    this._channels.set(channel.name, channel);
  }

  /** Extract the host name from a URL for use as the name of the corresponding [[TileRequestChannel]].
   * @throws TypeError if `url` is a string and does not represent a valid URL.
   * @see [[getForHttp]] to obtain or register a channel for the host name.
   */
  public static getNameFromUrl(url: URL | string): string {
    if (typeof url === "string")
      url = new URL(url);

    return url.hostname;
  }

  /** Obtain a channel that requests content over HTTP using HTTP 1.1 limits on simultaneous connections.
   * If a channel with the specified name does not already exist, it will be created and registered.
   * @see [[getNameFromUrl]] to obtain a channel name corresponding to a hostname.
   */
  public getForHttp(name: string): TileRequestChannel {
    let channel = this.get(name);
    if (!channel)
      this.add(channel = new TileRequestChannel(name, this.httpConcurrency));

    return channel;
  }

  /** Iterator over all of the channels. */
  public [Symbol.iterator](): Iterator<TileRequestChannel> {
    return this._channels.values()[Symbol.iterator]();
  }

  /** The maximum number of active requests for a channel that uses an RpcInterface to satisfy its requests.
   * For web-based applications, this is the same as [[httpConcurrency]], but for [[IpcApp]]s it is determined by the number of workers threads allocated by the backend.
   */
  public get rpcConcurrency(): number {
    return this._rpcConcurrency;
  }

  /** @internal */
  public getIModelTileChannel(tile: IModelTile): TileRequestChannel {
    return this.iModelChannels.getChannelForTile(tile);
  }

  /** Chiefly for debugging.
   * @internal
   */
  public setRpcConcurrency(concurrency: number): void {
    this._rpcConcurrency = concurrency;
    this.iModelChannels.setRpcConcurrency(concurrency);
    this.elementGraphicsRpc.concurrency = concurrency;
  }

  /** Statistics intended primarily for debugging. */
  public get statistics(): TileRequestChannelStatistics {
    const stats = new TileRequestChannelStatistics();
    for (const channel of this)
      channel.statistics.addTo(stats);

    return stats;
  }

  /** Reset all [[statistics]] to zero. */
  public resetStatistics(): void {
    for (const channel of this)
      channel.resetStatistics();
  }

  /** Invoked by [[TileAdmin.processQueue]] when it is about to start enqueuing new requests.
   * @internal
   */
  public swapPending(): void {
    for (const channel of this)
      channel.swapPending();
  }

  /** Invoked by [[TileAdmin.processQueue]] when it is about to start enqueuing new requests.
   * @internal
   */
  public process(): void {
    for (const channel of this)
      channel.process();
  }

  /** Invoked by [[TileAdmin.onIModelClosed]].
   * @internal
   */
  public onIModelClosed(iModel: IModelConnection): void {
    for (const channel of this)
      channel.onIModelClosed(iModel);
  }

  /** Invoked by [[TileAdmin.onShutDown]].
   * @internal
   */
  public onShutDown(): void {
    for (const channel of this)
      channel.cancelAndClearAll();

    this._channels.clear();
  }
}

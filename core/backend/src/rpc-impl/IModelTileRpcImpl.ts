/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import {
  IModelTileRpcInterface,
  IModelToken,
  RpcInterface,
  RpcManager,
  RpcPendingResponse,
  TileTreeProps,
} from "@bentley/imodeljs-common";
import {
  assert,
  ActivityLoggingContext,
  BeDuration,
  Logger,
} from "@bentley/bentleyjs-core";
import { IModelDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";
import { PromiseMemoizer, QueryablePromise } from "../PromiseMemoizer";

interface TileRequestProps {
  actx: ActivityLoggingContext;
  iModelToken: IModelToken;
  treeId: string;
}

function generateTileRequestKey(props: TileRequestProps): string {
  return `${JSON.stringify(props.iModelToken)}:${props.treeId}`;
}

abstract class TileRequestMemoizer<Result, Props extends TileRequestProps> extends PromiseMemoizer<Result> {
  private readonly _loggingCategory = "imodeljs-backend.IModelTileRequestRpc";
  protected abstract get _operationName(): string;
  protected abstract addMetadata(metadata: any, props: Props): void;
  protected abstract stringify(props: Props): string;
  protected abstract get _timeoutMilliseconds(): number;

  private makeMetadata(props: Props): any {
    const meta = { ...props.iModelToken };
    this.addMetadata(meta, props);
    return meta;
  }

  protected constructor(memoizeFn: (props: Props) => Promise<Result>, generateKeyFn: (props: Props) => string) {
    super(memoizeFn, generateKeyFn);
  }

  private _superMemoize = this.memoize;
  public memoize = (props: Props): QueryablePromise<Result> => {
    return this._superMemoize(props);
  }

  private _superDeleteMemoized = this.deleteMemoized;
  public deleteMemoized = (props: Props) => {
    this._superDeleteMemoized(props);
  }

  private log(status: string, props: Props): void {
    const descr = this._operationName + "(" + this.stringify(props) + ")";
    Logger.logTrace(this._loggingCategory, "Backend " + status + " " + descr, () => this.makeMetadata(props));
  }

  protected async perform(props: Props): Promise<Result> {
    props.actx.enter();
    this.log("received", props);

    const tileQP = this.memoize(props);
    const waitPromise = BeDuration.wait(this._timeoutMilliseconds);
    await Promise.race([tileQP.promise, waitPromise]);

    props.actx.enter();

    if (tileQP.isPending) {
      this.log("issuing pending status for", props);
      throw new RpcPendingResponse();
    }

    this.deleteMemoized(props);

    if (tileQP.isFulfilled) {
      this.log("completed", props);
      return tileQP.result!;
    }

    assert(tileQP.isRejected);
    this.log("rejected", props);
    throw tileQP.error!;
  }
}

async function getTileTreeProps(props: TileRequestProps): Promise<TileTreeProps> {
  const db = IModelDb.find(props.iModelToken);
  return db.tiles.requestTileTreeProps(props.actx, props.treeId);
}

class RequestTileTreePropsMemoizer extends TileRequestMemoizer<TileTreeProps, TileRequestProps> {
  protected get _timeoutMilliseconds() { return IModelHost.tileTreeRequestTimeout; }
  protected get _operationName() { return "requestTileTreeProps"; }
  protected stringify(props: TileRequestProps): string { return props.treeId; }
  protected addMetadata(meta: any, props: TileRequestProps): void {
    meta.treeId = props.treeId;
  }

  private static _instance?: RequestTileTreePropsMemoizer;

  private constructor() {
    super(getTileTreeProps, generateTileRequestKey);
  }

  public static async perform(props: TileRequestProps): Promise<TileTreeProps> {
    if (undefined === this._instance)
      this._instance = new RequestTileTreePropsMemoizer();

    return this._instance.perform(props);
  }
}

interface TileContentRequestProps extends TileRequestProps {
  contentId: string;
}

async function getTileContent(props: TileContentRequestProps): Promise<Uint8Array> {
  const db = IModelDb.find(props.iModelToken);
  return db.tiles.requestTileContent(props.actx, props.treeId, props.contentId);
}

function generateTileContentKey(props: TileContentRequestProps): string {
  return generateTileRequestKey(props) + `:${props.contentId}`;
}

class RequestTileContentMemoizer extends TileRequestMemoizer<Uint8Array, TileContentRequestProps> {
  protected get _timeoutMilliseconds() { return IModelHost.tileContentRequestTimeout; }
  protected get _operationName() { return "requestTileContent"; }
  protected stringify(props: TileContentRequestProps): string { return props.treeId + ":" + props.contentId; }
  protected addMetadata(meta: any, props: TileContentRequestProps): void {
    meta.treeId = props.treeId;
    meta.contentId = props.contentId;
  }

  private static _instance?: RequestTileContentMemoizer;

  private constructor() {
    super(getTileContent, generateTileContentKey);
  }

  public static async perform(props: TileContentRequestProps): Promise<Uint8Array> {
    if (undefined === this._instance)
      this._instance = new RequestTileContentMemoizer();

    return this._instance.perform(props);
  }
}

/** @hidden */
export class IModelTileRpcImpl extends RpcInterface implements IModelTileRpcInterface {
  public static register() { RpcManager.registerImpl(IModelTileRpcInterface, IModelTileRpcImpl); }

  public async getTileTreeProps(iModelToken: IModelToken, id: string): Promise<TileTreeProps> {
    const actx = ActivityLoggingContext.current; actx.enter();
    const db = IModelDb.find(iModelToken);
    return db.tiles.requestTileTreeProps(actx, id);
  }

  public async getTileContent(iModelToken: IModelToken, treeId: string, contentId: string): Promise<Uint8Array> {
    const actx = ActivityLoggingContext.current; actx.enter();
    const db = IModelDb.find(iModelToken);
    return db.tiles.requestTileContent(actx, treeId, contentId);
  }

  public async requestTileTreeProps(iModelToken: IModelToken, treeId: string): Promise<TileTreeProps> {
    const actx = ActivityLoggingContext.current; actx.enter();
    return RequestTileTreePropsMemoizer.perform({ actx, iModelToken, treeId });
  }

  public async requestTileContent(iModelToken: IModelToken, treeId: string, contentId: string): Promise<Uint8Array> {
    const actx = ActivityLoggingContext.current; actx.enter();
    return RequestTileContentMemoizer.perform({ actx, iModelToken, treeId, contentId });
  }
}

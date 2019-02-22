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

  protected async perform(props: Props): Promise<Result> {
    props.actx.enter();
    Logger.logTrace(this._loggingCategory, "Received backend " + this._operationName + " request", () => (props.iModelToken));

    const tileQP = this.memoize(props);
    const waitPromise = BeDuration.wait(100);
    await Promise.race([tileQP.promise, waitPromise]);

    props.actx.enter();

    if (tileQP.isPending) {
      Logger.logTrace(this._loggingCategory, "Issuing pending status for " + this._operationName + " request", () => (props.iModelToken));
      throw new RpcPendingResponse();
    }

    this.deleteMemoized(props);

    if (tileQP.isFulfilled) {
      Logger.logTrace(this._loggingCategory, "Completed " + this._operationName + " request", () => (props.iModelToken));
      return tileQP.result!;
    }

    assert(tileQP.isRejected);
    Logger.logTrace(this._loggingCategory, "Rejected " + this._operationName + " request", () => (props.iModelToken));
    throw tileQP.error!;
  }
}

async function getTileTreeProps(props: TileRequestProps): Promise<TileTreeProps> {
  const db = IModelDb.find(props.iModelToken);
  return db.tiles.requestTileTreeProps(props.actx, props.treeId);
}

class RequestTileTreePropsMemoizer extends TileRequestMemoizer<TileTreeProps, TileRequestProps> {
  protected get _operationName() { return "requestTileTreeProps"; }

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
  protected get _operationName() { return "requestTileContent"; }

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

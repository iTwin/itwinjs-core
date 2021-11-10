/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { AccessToken, assert, BeDuration, Id64Array, Logger } from "@itwin/core-bentley";
import {
  CloudStorageContainerDescriptor, CloudStorageContainerUrl, CloudStorageTileCache, ElementGraphicsRequestProps, IModelRpcProps,
  IModelTileRpcInterface, IModelTileTreeProps, RpcInterface, RpcInvocation, RpcManager, RpcPendingResponse, TileContentIdentifier,
  TileContentSource, TileTreeContentIds, TileVersionInfo,
} from "@itwin/core-common";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { IModelDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";
import { PromiseMemoizer, QueryablePromise } from "../PromiseMemoizer";
import { RpcTrace } from "../RpcBackend";
import { RpcBriefcaseUtility } from "./RpcBriefcaseUtility";

interface TileRequestProps {
  accessToken?: AccessToken;
  tokenProps: IModelRpcProps;
  treeId: string;
}

function generateTileRequestKey(props: TileRequestProps): string {
  const token = props.tokenProps;
  return `${JSON.stringify({
    key: token.key,
    iTwinId: token.iTwinId,
    iModelId: token.iModelId,
    changesetId: token.changeset?.id,
  })}:${props.treeId}`;
}

abstract class TileRequestMemoizer<Result, Props extends TileRequestProps> extends PromiseMemoizer<Result> {
  private readonly _loggerCategory = BackendLoggerCategory.IModelTileRequestRpc;
  protected abstract get _operationName(): string;
  protected abstract addMetadata(metadata: any, props: Props): void;
  protected abstract stringify(props: Props): string;
  protected abstract get _timeoutMilliseconds(): number;

  private makeMetadata(props: Props): any {
    const meta = { ...props.tokenProps };
    this.addMetadata(meta, props);
    return meta;
  }

  protected constructor(memoizeFn: (props: Props) => Promise<Result>, generateKeyFn: (props: Props) => string) {
    super(memoizeFn, generateKeyFn);
  }

  private _superMemoize = this.memoize;
  public override memoize = (props: Props): QueryablePromise<Result> => {
    return this._superMemoize(props);
  };

  private _superDeleteMemoized = this.deleteMemoized;
  public override deleteMemoized = (props: Props) => {
    this._superDeleteMemoized(props);
  };

  private log(status: string, props: Props): void {
    const descr = `${this._operationName}(${this.stringify(props)})`;
    Logger.logTrace(this._loggerCategory, `Backend ${status} ${descr}`, () => this.makeMetadata(props));
  }

  protected async perform(props: Props): Promise<Result> {
    this.log("received", props);

    const tileQP = this.memoize(props);

    await BeDuration.race(this._timeoutMilliseconds, tileQP.promise).catch(() => { });
    // Note: Rejections must be caught so that the memoization entry can be deleted

    if (tileQP.isPending) {
      this.log("issuing pending status for", props);
      throw new RpcPendingResponse();
    }

    this.deleteMemoized(props);

    if (tileQP.isFulfilled) {
      this.log("completed", props);
      assert(undefined !== tileQP.result);
      return tileQP.result;
    }

    assert(tileQP.isRejected);
    this.log("rejected", props);
    throw tileQP.error; // eslint-disable-line no-throw-literal
  }
}

async function getTileTreeProps(props: TileRequestProps): Promise<IModelTileTreeProps> {
  assert(undefined !== props.accessToken);
  const db = await RpcBriefcaseUtility.findOpenIModel(props.accessToken, props.tokenProps);
  return db.tiles.requestTileTreeProps(props.treeId);
}

class RequestTileTreePropsMemoizer extends TileRequestMemoizer<IModelTileTreeProps, TileRequestProps> {
  protected get _timeoutMilliseconds() { return IModelHost.tileTreeRequestTimeout; }
  protected get _operationName() { return "requestTileTreeProps"; }
  protected stringify(props: TileRequestProps): string { return props.treeId; }
  protected addMetadata(meta: any, props: TileRequestProps): void {
    meta.treeId = props.treeId;
  }

  private static _instance?: RequestTileTreePropsMemoizer;

  private constructor() {
    super(getTileTreeProps, generateTileRequestKey);
    IModelHost.onBeforeShutdown.addOnce(() => {
      this.dispose();
      RequestTileTreePropsMemoizer._instance = undefined;
    });
  }

  public static async perform(props: TileRequestProps): Promise<IModelTileTreeProps> {
    if (undefined === this._instance)
      this._instance = new RequestTileTreePropsMemoizer();

    return this._instance.perform(props);
  }
}

interface TileContentRequestProps extends TileRequestProps {
  contentId: string;
  guid?: string;
}

async function getTileContent(props: TileContentRequestProps): Promise<TileContentSource> {
  assert(undefined !== props.accessToken);
  const db = await RpcBriefcaseUtility.findOpenIModel(props.accessToken, props.tokenProps);
  const tile = await db.tiles.requestTileContent(props.treeId, props.contentId);

  // ###TODO: Verify the guid supplied by the front-end matches the guid stored in the model?
  if (IModelHost.usingExternalTileCache) {
    await IModelHost.tileUploader?.cacheTile(props.tokenProps, props.treeId, props.contentId, tile.content, props.guid, {
      backendName: IModelHost.applicationId,
      tileGenerationTime: tile.elapsedSeconds.toString(),
      tileSize: tile.content.byteLength.toString(),
    });

    return TileContentSource.ExternalCache;
  }

  return TileContentSource.Backend;
}

function generateTileContentKey(props: TileContentRequestProps): string {
  return `${generateTileRequestKey(props)}:${props.contentId}`;
}

class RequestTileContentMemoizer extends TileRequestMemoizer<TileContentSource, TileContentRequestProps> {
  protected get _timeoutMilliseconds() { return IModelHost.tileContentRequestTimeout; }
  protected get _operationName() { return "requestTileContent"; }
  protected stringify(props: TileContentRequestProps): string { return `${props.treeId}:${props.contentId}`; }
  protected addMetadata(meta: any, props: TileContentRequestProps): void {
    meta.treeId = props.treeId;
    meta.contentId = props.contentId;
  }

  private static _instance?: RequestTileContentMemoizer;

  private constructor() {
    super(getTileContent, generateTileContentKey);
    IModelHost.onBeforeShutdown.addOnce(() => {
      this.dispose();
      RequestTileContentMemoizer._instance = undefined;
    });
  }

  public static get instance() {
    if (undefined === this._instance)
      this._instance = new RequestTileContentMemoizer();

    return this._instance;
  }

  public static async perform(props: TileContentRequestProps): Promise<TileContentSource> {
    return this.instance.perform(props);
  }
}

/** @internal */
export class IModelTileRpcImpl extends RpcInterface implements IModelTileRpcInterface {
  public static register() { RpcManager.registerImpl(IModelTileRpcInterface, IModelTileRpcImpl); }

  public async requestTileTreeProps(tokenProps: IModelRpcProps, treeId: string): Promise<IModelTileTreeProps> {
    return RequestTileTreePropsMemoizer.perform({ accessToken: RpcTrace.expectCurrentActivity.accessToken, tokenProps, treeId });
  }

  public async purgeTileTrees(tokenProps: IModelRpcProps, modelIds: Id64Array | undefined): Promise<void> {
    // `undefined` gets forwarded as `null`...
    if (null === modelIds)
      modelIds = undefined;

    const db = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return db.nativeDb.purgeTileTrees(modelIds);
  }

  public async generateTileContent(tokenProps: IModelRpcProps, treeId: string, contentId: string, guid: string | undefined): Promise<TileContentSource> {
    return RequestTileContentMemoizer.perform({ accessToken: RpcTrace.expectCurrentActivity.accessToken, tokenProps, treeId, contentId, guid });
  }

  public async retrieveTileContent(tokenProps: IModelRpcProps, key: TileContentIdentifier): Promise<Uint8Array> {
    const db = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return db.tiles.getTileContent(key.treeId, key.contentId);
  }

  public async getTileCacheContainerUrl(_tokenProps: IModelRpcProps, id: CloudStorageContainerDescriptor): Promise<CloudStorageContainerUrl> {
    const invocation = RpcInvocation.current(this);

    if (!IModelHost.usingExternalTileCache) {
      return CloudStorageContainerUrl.empty();
    }

    const expiry = CloudStorageTileCache.getCache().supplyExpiryForContainerUrl(id);
    const clientIp = (IModelHost.restrictTileUrlsByClientIp && invocation.request.ip) ? invocation.request.ip : undefined;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return IModelHost.tileCacheService!.obtainContainerUrl(id, expiry, clientIp);
  }

  public async isUsingExternalTileCache(): Promise<boolean> { // eslint-disable-line @itwin/prefer-get
    return IModelHost.usingExternalTileCache;
  }

  public async queryVersionInfo(): Promise<TileVersionInfo> {
    return IModelHost.platform.getTileVersionInfo();
  }

  /** @internal */
  public async requestElementGraphics(rpcProps: IModelRpcProps, request: ElementGraphicsRequestProps): Promise<Uint8Array | undefined> {
    const iModel = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, rpcProps);
    return iModel.generateElementGraphics(request);
  }
}

/** @internal */
export async function cancelTileContentRequests(tokenProps: IModelRpcProps, contentIds: TileTreeContentIds[]): Promise<void> {
  const iModel = IModelDb.findByKey(tokenProps.key);
  const props: TileContentRequestProps = { tokenProps, treeId: "", contentId: "" };

  for (const entry of contentIds) {
    props.treeId = entry.treeId;
    for (const contentId of entry.contentIds) {
      props.contentId = contentId;
      RequestTileContentMemoizer.instance.deleteMemoized(props);
    }

    iModel.nativeDb.cancelTileContentRequests(entry.treeId, entry.contentIds);
  }
}

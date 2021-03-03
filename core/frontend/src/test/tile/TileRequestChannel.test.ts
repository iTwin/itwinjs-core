/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Range3d, Transform } from "@bentley/geometry-core";
import { ViewFlagOverrides } from "@bentley/imodeljs-common";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { Viewport } from "../../Viewport";
import { MockRender } from "../../render/MockRender";
import { createBlankConnection } from "../createBlankConnection";
import {
  Tile, TileContent, TileLoadPriority, TileLoadStatus, TileRequest, TileRequestChannel, TileTree,
} from "../../tile/internal";

class TestTile extends Tile {
  public priority;
  public requestChannel: LoggingChannel;
  public requestContentCalled = false;
  public readContentCalled = false;
  private _resolveRequest?: (response: TileRequest.Response) => void;
  private _rejectRequest?: (error: Error) => void;
  private _resolveRead?: (content: TileContent) => void;
  private _rejectRead?: (error: Error) => void;

  public constructor(tree: TestTree, channel: LoggingChannel, priority = 0) {
    super({
      contentId: priority.toString(),
      range: new Range3d(0, 0, 0, 1, 1, 1),
      maximumSize: 42,
    }, tree);

    this.requestChannel = channel;
    this.priority = priority;
  }

  public expectStatus(expected: TileLoadStatus) {
    expect(this.loadStatus).to.equal(expected);
  }

  public get awaitingRequest() {
    return undefined !== this._resolveRequest;
  }

  public get awaitingRead() {
    return undefined !== this._resolveRead;
  }

  public get isActive() {
    return this.channel.isActive(this);
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void): void {
    resolve(undefined);
  }

  public get channel() {
    return this.requestChannel;
  }

  public computeLoadPriority() {
    return this.priority;
  }

  public async requestContent(): Promise<TileRequest.Response> {
    this.requestContentCalled = true;
    expect(this._resolveRequest).to.be.undefined;
    expect(this._rejectRequest).to.be.undefined;
    return new Promise((resolve, reject) => {
      this._resolveRequest = resolve;
      this._rejectRequest = reject;
    });
  }

  public async readContent(): Promise<TileContent> {
    this.readContentCalled = true;
    expect(this._resolveRead).to.be.undefined;
    expect(this._rejectRead).to.be.undefined;
    return new Promise((resolve, reject) => {
      this._resolveRead = resolve;
      this._rejectRead = reject;
    });
  }

  public resolveRequest(response: TileRequest.Response = new Uint8Array(1)): void {
    expect(this._resolveRequest).not.to.be.undefined;
    this._resolveRequest!(response);
    this.clearPromises();
  }

  public rejectRequest(error: Error = new Error("requestContent")): void {
    expect(this._rejectRequest).not.to.be.undefined;
    this._rejectRequest!(error);
    this.clearPromises();
  }

  public resolveRead(content: TileContent = { }): void {
    expect(this._resolveRead).not.to.be.undefined;
    this._resolveRead!(content);
    this.clearPromises();
  }

  public rejectRead(error: Error = new Error("readContent")): void {
    expect(this._rejectRead).not.to.be.undefined;
    this._rejectRead!(error);
    this.clearPromises();
  }

  private clearPromises(): void {
    this._resolveRequest = undefined;
    this._rejectRequest = undefined;
    this._resolveRead = undefined;
    this._rejectRead = undefined;
  }
}

class TestTree extends TileTree {
  private readonly _rootTile: TestTile;

  public constructor(iModel: IModelConnection, channel: LoggingChannel, priority = TileLoadPriority.Primary) {
    super({
      iModel,
      id: "test",
      modelId: "0",
      location: Transform.createIdentity(),
      priority,
    });

    this._rootTile = new TestTile(this, channel);
  }

  public get rootTile(): TestTile { return this._rootTile; }
  public get is3d() { return true; }
  public get maxDepth() { return undefined; }
  public get viewFlagOverrides() { return new ViewFlagOverrides(); }
  protected _selectTiles(): Tile[] { return []; }
  public draw() { }
  public prune() { }
}

function mockViewport(viewportId: number, iModel: IModelConnection): Viewport {
  return {
    viewportId,
    iModel,
    invalidateScene: () => { },
  } as Viewport;
}

function requestTiles(vp: Viewport, tiles: TestTile[]): void {
  IModelApp.tileAdmin.clearTilesForViewport(vp);
  IModelApp.tileAdmin.clearUsageForViewport(vp);
  IModelApp.tileAdmin.requestTiles(vp, new Set<Tile>(tiles));
}

async function processOnce(): Promise<void> {
  IModelApp.tileAdmin.process();
  return new Promise((resolve: any) => setTimeout(resolve, 1));
}

class LoggingChannel extends TileRequestChannel {
  public readonly calledFunctions: string[] = [];

  protected log(functionName: string) {
    this.calledFunctions.push(functionName);
  }

  public clear() {
    this.calledFunctions.length = 0;
  }

  public expect(functionNames: string[]) {
    expect(this.calledFunctions).to.deep.equal(functionNames);
  }

  public expectRequests(active: number, pending: number) {
    expect(this.numActive).to.equal(active);
    expect(this.numPending).to.equal(pending);
  }

  public get active(): Set<TileRequest> {
    return this._active;
  }

  public isActive(tile: Tile): boolean {
    for (const active of this.active)
      if (active.tile === tile)
        return true;

    return false;
  }

  public recordCompletion(tile: Tile): void {
    this.log("recordCompletion");
    super.recordCompletion(tile);
  }

  public recordTimeout() {
    this.log("recordTimeout");
    super.recordTimeout();
  }

  public recordFailure() {
    this.log("recordFailure");
    super.recordFailure();
  }

  public swapPending() {
    this.log("swapPending");
    super.swapPending();
  }

  public append(request: TileRequest) {
    this.log("append");
    super.append(request);
  }

  public process() {
    this.log("process");
    super.process();
  }

  protected dispatch(request: TileRequest) {
    this.log("dispatch");
    super.dispatch(request);
  }

  public cancelAndClearAll() {
    this.log("cancelAndClearAll");
    super.cancelAndClearAll();
  }

  public onNoContent(request: TileRequest): boolean {
    this.log("onNoContent");
    return super.onNoContent(request);
  }

  public onActiveRequestCanceled(request: TileRequest): void {
    this.log("onActiveRequestCanceled");
    super.onActiveRequestCanceled(request);
  }

  public onIModelClosed(iModel: IModelConnection) {
    this.log("onIModelClosed");
    super.onIModelClosed(iModel);
  }

  protected dropActiveRequest(request: TileRequest) {
    this.log("dropActiveRequest");
    super.dropActiveRequest(request);
  }

  protected cancel(request: TileRequest) {
    this.log("cancel");
    super.cancel(request);
  }

  public async requestContent(tile: Tile, isCanceled: () => boolean): Promise<TileRequest.Response> {
    this.log("requestContent");
    return super.requestContent(tile, isCanceled);
  }

  public processCancellations() {
    this.log("processCancellations");
    super.processCancellations();
  }
}

describe("TileRequestChannel", () => {
  let imodel: IModelConnection;

  beforeEach(async () => {
    await MockRender.App.startup();
    imodel = createBlankConnection();
  });

  afterEach(async () => {
    await imodel.close();
    if (IModelApp.initialized)
      await MockRender.App.shutdown();
  });

  it("completes one request", async () => {
    const channel = new LoggingChannel("test", 1);
    IModelApp.tileAdmin.channels.add(channel);
    const tree = new TestTree(imodel, channel);
    const vp = mockViewport(1, imodel);

    tree.rootTile.expectStatus(TileLoadStatus.NotLoaded);
    channel.expectRequests(0, 0);
    requestTiles(vp, [tree.rootTile]);
    tree.rootTile.expectStatus(TileLoadStatus.NotLoaded);
    channel.expectRequests(0, 0);
    channel.expect([]);

    IModelApp.tileAdmin.process();
    tree.rootTile.expectStatus(TileLoadStatus.Queued);
    channel.expect(["swapPending", "append", "process", "processCancellations", "dispatch", "requestContent"]);
    channel.expectRequests(1, 0);

    channel.clear();
    tree.rootTile.resolveRequest();
    await processOnce();
    channel.expect(["swapPending", "process", "processCancellations", "dropActiveRequest"]);
    channel.expectRequests(0, 0);
    tree.rootTile.expectStatus(TileLoadStatus.Loading);

    channel.clear();
    tree.rootTile.resolveRead();
    await processOnce();
    channel.expect(["swapPending", "process", "processCancellations", "recordCompletion"]);
    channel.expectRequests(0, 0);
    tree.rootTile.expectStatus(TileLoadStatus.Ready);
  });

  it("observes limits on max active requests", async () => {
    const channel = new LoggingChannel("test", 2);
    IModelApp.tileAdmin.channels.add(channel);
    const tree = new TestTree(imodel, channel);
    const tiles = [0, 1, 2, 3, 4].map((x) => new TestTile(tree, channel, x));
    const vp = mockViewport(1, imodel);

    requestTiles(vp, tiles);
    IModelApp.tileAdmin.process();
    tiles.forEach((x) => x.expectStatus(TileLoadStatus.Queued));
    channel.expectRequests(2, 3);

    tiles[0].resolveRequest();
    await processOnce();
    tiles.forEach((x) => x.expectStatus(x === tiles[0] ? TileLoadStatus.Loading : TileLoadStatus.Queued));
    channel.expectRequests(1, 3);

    tiles[0].resolveRead();
    await processOnce();
    tiles.forEach((x) => x.expectStatus(x === tiles[0] ? TileLoadStatus.Ready : TileLoadStatus.Queued));
    channel.expectRequests(2, 2);

    tiles[1].rejectRequest();
    await processOnce();
    tiles[1].expectStatus(TileLoadStatus.NotFound);
    tiles.slice(2).forEach((x) => x.expectStatus(TileLoadStatus.Queued));
    channel.expectRequests(1, 2);

    tiles.push(new TestTile(tree, channel, 5));
    requestTiles(vp, tiles);
    await processOnce();
    channel.expectRequests(2, 2);

    tiles[2].resolveRequest();
    tiles[3].resolveRequest();
    await processOnce();
    channel.expectRequests(0, 2);
    tiles.slice(2, 4).forEach((x) => x.expectStatus(TileLoadStatus.Loading));
    tiles.slice(4).forEach((x) => x.expectStatus(TileLoadStatus.Queued));

    tiles[2].resolveRead();
    tiles[3].resolveRead();
    await processOnce();
    channel.expectRequests(2, 0);
    tiles.slice(2, 4).forEach((x) => x.expectStatus(TileLoadStatus.Ready));
    tiles.slice(4).forEach((x) => x.expectStatus(TileLoadStatus.Queued));

    tiles[4].rejectRequest();
    tiles[5].rejectRequest();
    await processOnce();
    channel.expectRequests(0, 0);
    tiles.slice(4).forEach((x) => x.expectStatus(TileLoadStatus.NotFound));
  });

  it("dispatches requests in order by priority", async () => {
    const channel = new LoggingChannel("test", 1);
    IModelApp.tileAdmin.channels.add(channel);
    const tr0 = new TestTree(imodel, channel, TileLoadPriority.Dynamic);
    const tr1 = new TestTree(imodel, channel, TileLoadPriority.Terrain);

    const t00 = new TestTile(tr0, channel, 0);
    const t04 = new TestTile(tr0, channel, 4);
    const t10 = new TestTile(tr1, channel, 0);
    const t14 = new TestTile(tr1, channel, 4);

    const vp = mockViewport(1, imodel);
    requestTiles(vp, [t10, t04, t00, t14 ]);

    async function waitFor(tile: TestTile) {
      await processOnce();
      expect(channel.numActive).to.equal(1);
      expect(tile.isActive).to.be.true;
      tile.expectStatus(TileLoadStatus.Queued);
      tile.resolveRequest();
      await processOnce();
      tile.expectStatus(TileLoadStatus.Loading);
      tile.resolveRead();
      await processOnce();
      tile.expectStatus(TileLoadStatus.Ready);
    }

    await processOnce();
    channel.expectRequests(1, 3);
    await waitFor(t00);
    channel.expectRequests(1, 2);
    await waitFor(t04);
    channel.expectRequests(1, 1);
    await waitFor(t10);

    // t14 is now the actively-loading tile. Enqueue some additional ones. The priorities only apply to the queue, not the active set.
    channel.expectRequests(1, 0);
    expect(t14.isActive).to.be.true;

    const t15 = new TestTile(tr1, channel, 5);
    const t03 = new TestTile(tr0, channel, 3);
    const t12 = new TestTile(tr1, channel, 2);
    requestTiles(vp, [t14, t15, t03, t12]);

    await processOnce();
    channel.expectRequests(1, 3);
    await waitFor(t14);
    channel.expectRequests(1, 2);
    await waitFor(t03);
    channel.expectRequests(1, 1);
    await waitFor(t12);
    channel.expectRequests(1, 0);
    await waitFor(t15);
    channel.expectRequests(0, 0);
  });

  it("cancels requests", async () => {
    const channel = new LoggingChannel("test", 1);
    IModelApp.tileAdmin.channels.add(channel);
    const tree = new TestTree(imodel, channel);
    const tiles = [0, 1, 2, 3].map((x) => new TestTile(tree, channel, x));

    const vp = mockViewport(1, imodel);
    requestTiles(vp, tiles);
    IModelApp.tileAdmin.process();
    channel.expectRequests(1, 3);
    expect(tiles[0].awaitingRequest).to.be.true;

    // Cancel all of the requests
    requestTiles(vp, []);
    IModelApp.tileAdmin.process();

    // Canceled active requests are not removed until the promise resolves or rejects.
    channel.expectRequests(1, 0);
    expect(tiles[0].awaitingRequest).to.be.true;
    expect(tiles[0].isActive).to.be.true;

    tiles[0].rejectRequest();
    await processOnce();
    expect(tiles[0].awaitingRead).to.be.false;
    tiles[0].expectStatus(TileLoadStatus.NotFound);
    tiles[0] = new TestTile(tree, channel, 0); // reset to an unloaded tile
    channel.expectRequests(0, 0);
    tiles.forEach((x) => x.expectStatus(TileLoadStatus.NotLoaded));

    requestTiles(vp, tiles);
    await processOnce();
    expect(tiles[0].isActive).to.be.true;

    requestTiles(vp, tiles.slice(1, 3));
    tiles[0].rejectRequest();
    await processOnce();
    channel.expectRequests(0, 2);
    tiles[0].expectStatus(TileLoadStatus.NotFound);
    await processOnce();
    channel.expectRequests(1, 1);
    expect(tiles[1].isActive).to.be.true;

    // Cancel all requests.
    requestTiles(vp, []);
    IModelApp.tileAdmin.process();
    channel.expectRequests(1, 0);
    expect(tiles[1].isActive).to.be.true;
    expect(tiles[1].awaitingRequest).to.be.true;

    tiles[1].resolveRequest();
    await processOnce();
    channel.expectRequests(0, 0);
    expect(tiles[1].awaitingRequest).to.be.false;
    // If we've already received a response, we process it even if request was canceled.
    expect(tiles[1].awaitingRead).to.be.true;

    tiles[1].resolveRead();
    await processOnce();
    tiles[1].expectStatus(TileLoadStatus.Ready);
    tiles.slice(2).forEach((x) => x.expectStatus(TileLoadStatus.NotLoaded));
  });

  it("changes max active requests", async () => {
    const channel = new LoggingChannel("test", 3);
    IModelApp.tileAdmin.channels.add(channel);
    const tree = new TestTree(imodel, channel);
    const tiles = [0, 1, 2, 3, 4].map((x) => new TestTile(tree, channel, x));

    const vp = mockViewport(1, imodel);
    requestTiles(vp, tiles);
    IModelApp.tileAdmin.process();
    channel.expectRequests(3, 2);

    channel.concurrency = 1;
    await processOnce();
    channel.expectRequests(3, 2);

    tiles[0].rejectRequest();
    await processOnce();
    channel.expectRequests(2, 2);

    tiles[1].resolveRequest();
    await processOnce();
    tiles[1].resolveRead();
    await processOnce();
    channel.expectRequests(1, 2);

    tiles[2].rejectRequest();
    await processOnce();
    channel.expectRequests(0, 2);
    IModelApp.tileAdmin.process();
    channel.expectRequests(1, 1);

    tiles[3].rejectRequest();
    await processOnce();
    channel.expectRequests(0, 1);
    IModelApp.tileAdmin.process();
    channel.expectRequests(1, 0);

    const tile = new TestTile(tree, channel, 5);
    requestTiles(vp, [tiles[4], tile]);
    IModelApp.tileAdmin.process();
    channel.expectRequests(1, 1);

    tiles[4].resolveRequest();
    await processOnce();
    tiles[4].resolveRead();
    await processOnce();
    channel.expectRequests(1, 0);

    tile.rejectRequest();
    await processOnce();
    channel.expectRequests(0 ,0);
  });

  it("processes requests", async () => {
  });

  it("does not drop active request until response is received", async () => {
  });

  it("can override Tile.requestContent", () => {
  });

  it("can accumulate cancellations", async () => {
  });

  it("produces statistics", async () => {
  });

  it("handles exceptions in readContent and requestContent", async () => {
  });
});

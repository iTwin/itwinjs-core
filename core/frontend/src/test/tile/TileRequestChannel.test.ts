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
  public requestChannel: TileRequestChannel;
  public requestContentCalled = false;
  public readContentCalled = false;
  private _resolveRequest?: (response: TileRequest.Response) => void;
  private _rejectRequest?: (error: Error) => void;
  private _resolveRead?: (content: TileContent) => void;
  private _rejectRead?: (error: Error) => void;

  public constructor(tree: TestTree, channel: TileRequestChannel, priority = 0) {
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

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void): void {
    resolve(undefined);
  }

  public get channel() {
    return this.requestChannel;
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

  public resolveRequest(response: TileRequest.Response): void {
    expect(this._resolveRequest).not.to.be.undefined;
    this._resolveRequest!(response);
    this.clearPromises();
  }

  public rejectRequest(error: Error): void {
    expect(this._rejectRequest).not.to.be.undefined;
    this._rejectRequest!(error);
    this.clearPromises();
  }

  public resolveRead(content: TileContent): void {
    expect(this._resolveRead).not.to.be.undefined;
    this._resolveRead!(content);
    this.clearPromises();
  }

  public rejectRead(error: Error): void {
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

  public constructor(iModel: IModelConnection, channel: TileRequestChannel, priority = TileLoadPriority.Primary) {
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
  IModelApp.tileAdmin.requestTiles(vp, new Set<Tile>(tiles));
}

async function processOnce(): Promise<void> {
  IModelApp.tileAdmin.process();
  return new Promise((resolve: any) => setTimeout(resolve, 1));
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

  it("processes one request", async () => {
    class Channel extends TileRequestChannel {
      public readonly calledFunctions: string[] = [];

      public constructor() {
        super("test", 1);
      }

      private log(functionName: string) {
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

      public recordCompletion(tile: Tile): void {
        this.log("recordCompletion");
        super.recordCompletion(tile);
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

    const channel = new Channel();
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
    tree.rootTile.resolveRequest("content");
    await processOnce();
    channel.expect(["swapPending", "process", "processCancellations", "dropActiveRequest"]);
    channel.expectRequests(0, 0);
    tree.rootTile.expectStatus(TileLoadStatus.Loading);

    channel.clear();
    tree.rootTile.resolveRead({ });
    await processOnce();
    channel.expect(["swapPending", "process", "processCancellations", "recordCompletion"]);
    channel.expectRequests(0, 0);
    tree.rootTile.expectStatus(TileLoadStatus.Ready);
  });

  it("observes limits on max active requests", async () => {
  });

  it("changes max active requests", async () => {
  });

  it("processes requests", async () => {
  });

  it("can override Tile.requestContent", () => {
  });

  it("can accumulate cancellations", async () => {
  });

  it("produces statistics", async () => {
  });
});


/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";

import {
  ArcGISTileMap, QuadId,
} from "../../../tile/internal";
import { BeEvent } from "@itwin/core-bentley";

const fakeArcGisUrl = "https:localhost/test/rest";
// This tilemap for parent tile (9,5,5),
// children: [10,10,10],[10,10,11],[10,11,10], [10,11,11]
// From tilemap, only [10,10,10], 10,11,11] are availability
const dataset1 = {
  tilemap: {
    adjusted:false,
    location:{left:9,top:9,width:4,height:4},
    data: [
      0,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,0],
  },
  available:[true,false,false,true],
  parentContentId: "9_5_5", // NOTE: format is <level>_<column>_<row>
};

const dataset2 = {
  tilemap1: {
    adjusted:true,
    location:{left:7,top:7,width:4, height:8},
    data:[
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 1,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0],
  },
  tilemap2: {
    adjusted:false,
    location:{left:11,top:7,width:8, height:8},
    data: [
      0, 0, 0, 0, 0, 0, 0, 0,
      1, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0],
  },

  tilemap3: {
    adjusted:true,
    location:{left:11,top:7,width:0, height:0},
    data: [],
  },

  availableClipped: [false,false,true,false],
  available:[false,false,true,true],
  parentContentId: "9_5_5",
};

// In this dataset the tilemap does not include any of the requested tiled
const dataset4 = {
  tilemap1: {
    adjusted:true,
    location:{left:7,top:7,width:1, height:8},
    data:[
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0],
  },
  tilemap2: {
    adjusted:false,
    location:{left:10,top:10,width:8, height:8},
    data: [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0],
  },
  available:[false,false,false,true],
  parentContentId: "9_5_5",
};

// This is really a far fetch case where the tile would be clipped, but tilemap is empty
// Code should survive to this.
const dataset5 = {
  tilemap: {
    adjusted: true,
    location:{left:7,top:7,width:0, height:0},
    data:[0],
  },
  available:[false,false,false,false],
  parentContentId: "9_5_5",
};

const dataset3 = {
  tilemap: {
    adjusted:false,
    location:{left:0,top:0,width:8,height:8},
    data: [
      1, 1, 0, 0, 0, 0, 0, 0,
      1, 1, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 1, 1, 1, 0, 0,
      0, 0, 0, 1, 1, 1, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0],
  },
  available:[true,true,true,true],
  parentContentId: "9_0_0",
};

// 8x8 dataset, 2 parent tiles are visible in the same tilemap
// the second one is only half visible
const dataset6 = {
  tilemap: {
    adjusted:false,
    location:{left:37,top:37,width:8,height:8},
    data: [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 1, 1, 1, 0, 0,
      0, 0, 0, 1, 1, 1, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0],
  },
  available:[true,true,true,true],     // first parent, fully visible
  parentContentId: "14_20_20", // NOTE: format is <level>_<column>_<row>
  sibling: {
    available:[true,false,true,false],   // second parent tile: half of it is visible
    parentContentId: "14_21_20", // NOTE: format is <level>_<column>_<row>
  },
};

// dataset7 depends on dataset6 to test cache check
const dataset7 = {
  tilemap: {
    adjusted:false,
    location:{
      left: dataset6.tilemap.location.left+dataset6.tilemap.location.width,
      top:dataset6.tilemap.location.top,
      width:8, height:8},
    data: [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      1, 0, 0, 1, 1, 1, 0, 0,
      1, 0, 0, 1, 1, 1, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0],
  },
  available:[false,false,true,true],
  parentContentId: "14_22_20", // NOTE: format is <level>_<column>_<row>
};

const dataset8 = {
  tilemap: {
    adjusted:false,
    location:{
      left:dataset6.tilemap.location.left,
      top:dataset6.tilemap.location.top+dataset6.tilemap.location.height,
      width:8,height:8},
    data: [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      1, 0, 0, 1, 1, 1, 0, 0,
      1, 0, 0, 1, 1, 1, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0],
  },
  available:[false,false,true,true],
  parentContentId: "14_20_22", // NOTE: format is <level>_<column>_<row>
};

const emptyBundleError = {
  error: {
    code: 422,
  },
};

const wmsSampleSource = { formatId: "WMS", url: "https://localhost/wms", name: "Test WMS" };
const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
const fakeFetchFunction = async (_url: URL, _options?: RequestInit): Promise<Response> => {
  return new Response();
};

// uncomment this to get traces
// Logger.initializeToConsole();
// Logger.setLevelDefault(LogLevel.Trace);
describe("ArcGISTileMap", () => {
  const sandbox = sinon.createSandbox();

  const getTilemapLocation = (parentTile: QuadId, offset: number = 0) => {
    const childIds = parentTile.getChildIds();
    const row = Math.max(childIds[0].row - offset, 0);
    const column = Math.max(childIds[0].column - offset, 0);
    return {level:childIds[0].level, row, column};
  };

  const getChildrenAvailability = async (parentContentId: string, fakeTileMapData: any) => {
    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, _row: unknown, _column: unknown, _width: unknown, _height: unknown): Promise<any>  {
      return fakeTileMapData;
    });
    const parentQuadId = QuadId.createFromContentId(parentContentId);
    const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
    const childIds =  parentQuadId.getChildIds();
    const available = await tileMap.getChildrenAvailability(parentQuadId.getChildIds());
    return {available, tileMap, getTileMapStub, childIds};
  };

  afterEach(async () => {
    sandbox.restore();
  });

  it("8x8 tilemap; simple children availability check", async () => {

    const {available, getTileMapStub} = await getChildrenAvailability(dataset6.parentContentId, dataset6.tilemap);
    expect(available).to.eql(dataset6.available);
    expect(getTileMapStub.calledOnce).to.be.true;
  });

  it("8x8 tilemap; tile map cached", async () => {

    const {available, getTileMapStub, tileMap, childIds} = await getChildrenAvailability(dataset6.parentContentId, dataset6.tilemap);
    expect(available).to.eql(dataset6.available);
    expect(getTileMapStub.calledOnce).to.be.true;

    // Make sure values got cached correctly
    const tileInfo = (tileMap as any).getAvailableTilesFromCache(childIds);
    expect(tileInfo.allTilesFound).to.be.true;
    expect(tileInfo.available).to.eql(dataset6.available);
  });

  it("8x8 tilemap; two children availability check, single server request", async () => {

    // eslint-disable-next-line prefer-const
    let {available, getTileMapStub, tileMap} = await getChildrenAvailability(dataset6.parentContentId, dataset6.tilemap);
    expect(available).to.eql(dataset6.available);
    expect(getTileMapStub.calledOnce).to.be.true;

    // Make sure the request tile was put in the middle of the tilemap
    const parentQuadId = QuadId.createFromContentId(dataset6.parentContentId);
    const tilemapLocation = getTilemapLocation(parentQuadId, 3);
    expect(getTileMapStub.calledWithExactly(tilemapLocation.level, tilemapLocation.row, tilemapLocation.column, tileMap.tileMapRequestSize, tileMap.tileMapRequestSize)).to.be.true;

    // Request parent tile next to the initial one (on the right), only the bottom,right child should exist
    // no server request should be made
    getTileMapStub.resetHistory();
    const reqParentTile2 = QuadId.createFromContentId(dataset6.sibling.parentContentId);
    expect(getTileMapStub.called).to.be.false;
    available = await tileMap.getChildrenAvailability(reqParentTile2.getChildIds());
    expect(available).to.eql(dataset6.sibling.available);
    expect(getTileMapStub.calledOnce).to.be.false;
  });

  it("Tile map location should change if data already in cache", async () => {
    let selectedDataset = "";
    // const getSelectedDataset = () => selectedDataset;
    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, _row: unknown, _column: unknown, _width: unknown, _height: unknown): Promise<any>  {
      if (selectedDataset === "dataset6")
        return dataset6.tilemap;
      else if (selectedDataset === "dataset7")
        return dataset7.tilemap;
      else if (selectedDataset === "dataset8")
        return dataset8.tilemap;
    });
    let parentQuadId = QuadId.createFromContentId(dataset6.parentContentId);
    const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);

    // Populate the cache using dataset 6
    selectedDataset = "dataset6";
    const childIDs = parentQuadId.getChildIds();
    await tileMap.getChildrenAvailability(parentQuadId.getChildIds());

    // Request tiles that are not covered by the previous request
    // the tilemap location should not overlap with previous tile map request, and should be
    // located on the right.
    getTileMapStub.resetHistory();
    selectedDataset = "dataset7";
    parentQuadId = QuadId.createFromContentId(dataset7.parentContentId);
    expect(getTileMapStub.called).to.be.false;
    await tileMap.getChildrenAvailability(parentQuadId.getChildIds());
    expect(getTileMapStub.calledWithExactly(childIDs[0].level, dataset7.tilemap.location.top, dataset7.tilemap.location.left,
      dataset7.tilemap.location.width, dataset7.tilemap.location.height)).to.be.true;

    getTileMapStub.resetHistory();
    selectedDataset = "dataset8";
    parentQuadId = QuadId.createFromContentId(dataset8.parentContentId);
    expect(getTileMapStub.called).to.be.false;
    await tileMap.getChildrenAvailability(parentQuadId.getChildIds());
    expect(getTileMapStub.calledWithExactly(childIDs[0].level, dataset8.tilemap.location.top, dataset8.tilemap.location.left,
      dataset8.tilemap.location.width, dataset8.tilemap.location.height)).to.be.true;

  });

  it("should serialize async requests", async () => {

    const waitingEvent = new BeEvent();
    let firstRequest = true;
    const waitingPromise = new Promise<void>(async (resolve, reject) => {
      try {
        if (firstRequest) {
          firstRequest = false;
          waitingEvent.addListener(()=>resolve());
        } else {
          resolve();
        }

      } catch (err: any) {
        reject();
      }
    });

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, _row: unknown, _column: unknown, _width: unknown, _height: unknown): Promise<any>  {
      await waitingPromise;
      return dataset6.tilemap;
    });
    const parentQuadId = QuadId.createFromContentId(dataset6.parentContentId);
    const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
    const requestPromise1 =  tileMap.getChildrenAvailability(parentQuadId.getChildIds());
    const requestPromise2 =  tileMap.getChildrenAvailability(parentQuadId.getChildIds());
    waitingEvent.raiseEvent();
    const results = await Promise.all([requestPromise1, requestPromise2]);

    // Make sure both results are the same
    expect(results[0]).to.eql(dataset6.available);
    expect(results[1]).to.eql(dataset6.available);

    // fetch from serer should be called once (second requests uses cache)
    expect(getTileMapStub.calledOnce).to.be.true;
  });

  // Since the parent tile is located on the edge of the LOD,
  // no offset should be applied the requested tile (i.e we should not end up with negatives values for row,columns)
  it("Test 8x8 tilemap request, top-left tile of LOD", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, _row: unknown, _column: unknown, _width: unknown, _height: unknown): Promise<any>  {
      return dataset3.tilemap;
    });

    const parentQuadId = QuadId.createFromContentId(dataset3.parentContentId);

    const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
    const available = await tileMap.getChildrenAvailability(parentQuadId.getChildIds());

    expect(available).to.eql(dataset3.available);

    const tilemapLocation = getTilemapLocation(parentQuadId, 0);
    expect(getTileMapStub.calledWithExactly(tilemapLocation.level, tilemapLocation.row, tilemapLocation.column, tileMap.tileMapRequestSize,tileMap.tileMapRequestSize)).to.be.true;

  });

  describe("Clipped Tile map response", () => {

    // Response contains an adjusted tilemap, a second request need to be made to get all tiles
    it("Should make second request when response got adjusted (partly clipped)", async () => {

      const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, row: unknown, column: unknown, _width: unknown, _height: unknown): Promise<any>  {
        if (row === 7 && column === 7)
          return dataset2.tilemap1;
        else
          return dataset2.tilemap2;
      });

      const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
      const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset2.parentContentId).getChildIds());
      expect(getTileMapStub.getCalls().length).to.eql(2);
      expect(available).to.eql(dataset2.available);
    });

    it("Should make second request when response got adjusted (fully clipped)", async () => {

      const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, row: unknown, column: unknown, _width: unknown, _height: unknown): Promise<any>  {
        if (row === 7 && column === 7)
          return dataset4.tilemap1;
        else
          return dataset4.tilemap2;
      });

      const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
      const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset2.parentContentId).getChildIds());
      expect(getTileMapStub.getCalls().length).to.eql(2);
      expect(available).to.eql(dataset4.available);
    });

    it("Should return consistent availability response when second request fail", async () => {

      const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, row: unknown, column: unknown, _width: unknown, _height: unknown): Promise<any>  {
        if (row === 7 && column === 7)
          return dataset2.tilemap1;
        else
          return emptyBundleError;
      });

      const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
      const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset2.parentContentId).getChildIds());
      expect(getTileMapStub.getCalls().length).to.eql(2);
      expect(available).to.eql(dataset2.availableClipped);
    });

    it("Should stop making requests when none of missing tiles can be retrieved", async () => {

      const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, _row: unknown, _column: unknown, _width: unknown, _height: unknown): Promise<any>  {
        return dataset5.tilemap;
      });

      const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
      const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset2.parentContentId).getChildIds());
      expect(getTileMapStub.getCalls().length).to.eql(4);
      expect(available).to.eql(dataset5.available);
    });

    it("Should stop making request if only a subset of missing tiles can be retrieved", async () => {

      const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, row: unknown, column: unknown, _width: unknown, _height: unknown): Promise<any>  {
        if (row === 7 && column === 7)
          return dataset2.tilemap1;
        else
          return dataset2.tilemap3;
      });

      const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
      const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset2.parentContentId).getChildIds());
      expect(getTileMapStub.getCalls().length).to.eql(4);
      expect(available).to.eql(dataset2.availableClipped);
    });
  });

  it("Test empty tilemap response", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: unknown, _row: unknown, _column: unknown, _width: unknown, _height: unknown): Promise<any>  {
      return emptyBundleError;
    });

    const allFalse = [false,false,false,false];
    const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fakeFetchFunction);
    tileMap.tileMapRequestSize = 4;
    const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset2.parentContentId).getChildIds());
    expect(getTileMapStub.calledOnce).to.be.true;
    expect(available).to.eql(allFalse);

    const children = QuadId.createFromContentId(dataset1.parentContentId).getChildIds();
    const tileInfo = (tileMap as any).getAvailableTilesFromCache(children);
    expect(tileInfo.allTilesFound).to.be.true;
    expect(tileInfo.available).to.eql(allFalse);
  });

  it("should call the fetch function", async () => {

    let fetchFunctionCalls = 0;
    const fetchFunction = async (_url: URL, _options?: RequestInit): Promise<Response> => {
      fetchFunctionCalls++;
      return new Response();
    };

    const parentQuadId = QuadId.createFromContentId(dataset6.parentContentId);
    const tileMap = new ArcGISTileMap(fakeArcGisUrl, settings, fetchFunction);
    tileMap.tileMapRequestSize = 8;
    await tileMap.getChildrenAvailability(parentQuadId.getChildIds());

    expect(fetchFunctionCalls).to.equals(1);
  });
});

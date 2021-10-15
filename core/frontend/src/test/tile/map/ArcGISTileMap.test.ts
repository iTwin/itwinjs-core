/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";

import {
  ArcGISTileMap, QuadId,
} from "../../../tile/internal";

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
  tilemap: {
    adjusted:true,
    location:{left:9,top:9,width:3,height:3},
    data:[
      0,0,0,
      0,1,0,
      0,0,1]},
  available:[true,false,false,true],
  parentContentId: "9_5_5",
};

const dataset3 = {
  tilemap: {
    adjusted:false,
    location:{left:0,top:0,width:4,height:4},
    data:[
      1,1,0,0,
      1,1,0,0,
      0,0,0,0]},
  available:[true,true,true,true],
  parentContentId: "9_0_0",
};

const dataset4 = {
  tilemap: {
    adjusted:true,
    location:{left:9,top:9,width:2,height:2},
    data:[
      1,1,
      1,1]},
  available:[true,true,true,true],
  parentContentId: "9_5_5",
};

const dataset5 = {
  tilemap: {
    adjusted:true,
    location:{left:10,top:10,width:1,height:1},
    data:[
      1]},
  available:[true,true,true,true],
  parentContentId: "9_5_5",
};

// 8x8 dataset, 2 parent tiles are visible in the same tilemap
// the second one is only half visible
const dataset6 = {
  tilemap: {
    adjusted:false,
    location:{left:7,top:7,width:8,height:8},
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
  available1:[true,true,true,true],     // first parent, fully visible
  available2:[true,false,true,false],   // second parent tile: half of it is visible
  parentContentId1: "14_20_20", // NOTE: format is <level>_<column>_<row>
  parentContentId2: "14_21_20", // NOTE: format is <level>_<column>_<row>
};

const emptyBundleError = {
  error: {
    code: 422,
  },
};

describe("ArcGISTileMap", () => {
  const sandbox = sinon.createSandbox();

  const getRequestTile = (parentTile: QuadId, tileMapRequestSize?: number) => {
    const childRow = parentTile.row * 2;
    const childColumn = parentTile.column * 2;
    const childLevel = parentTile.level + 1;
    let offset = 0;
    if (tileMapRequestSize !== undefined) {
      offset = (tileMapRequestSize/2.0)-1;
    }
    const row = Math.max(childRow - offset, 0);
    const column = Math.max(childColumn - offset, 0);
    return {level:childLevel, row, column};
  };
  afterEach(async () => {
    sandbox.restore();
  });

  it("Test simple 4x4 tilemap request", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset1.tilemap;
    });

    const parentQuadId = QuadId.createFromContentId(dataset1.parentContentId);
    // ArcGISTileMap assumes QuadId.getChildIds to return children in row major orientation.
    // lets make sure this is true
    const children = parentQuadId.getChildIds();
    const level = 10;
    const row = 10;
    const column = 10;
    for (let j=0, k=0; j < 2; j++) {
      for (let i=0; i < 2; i++) {
        const child = children[k++];
        expect(child.level).to.be.equals(level);
        expect(child.row).to.be.equals(row+j);
        expect(child.column).to.be.equals(column+i);
      }
    }

    const tileMap = new ArcGISTileMap(fakeArcGisUrl);
    tileMap.tileMapRequestSize = 4;
    let available = await tileMap.getChildrenAvailability(parentQuadId.getChildIds());

    // [10,10,10], 10,11,11] should be visible
    expect(available).to.eql(dataset1.available);

    expect(getTileMapStub.calledOnce).to.be.true;

    // Make sure that tile [10,10,10] was put in the middle of tilemap, so the request tile should be [10,9,9], size: 4x4
    const requestTile1 = getRequestTile(parentQuadId, tileMap.tileMapRequestSize);
    expect(getTileMapStub.calledWithExactly(requestTile1.level, requestTile1.row, requestTile1.column, tileMap.tileMapRequestSize,tileMap.tileMapRequestSize)).to.be.true;

    // Make sure values got cached correctly
    const tileInfo = (tileMap as any).getAvailableTilesFromCache(children);
    expect(tileInfo.allTilesFound).to.be.true;
    expect(tileInfo.available).to.eql(dataset1.available);

    // Result in cache, no server request should be made
    getTileMapStub.resetHistory();
    available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset1.parentContentId).getChildIds());
    expect(tileInfo.allTilesFound).to.be.true;
    expect(available).to.eql(dataset1.available);
    expect(getTileMapStub.called).to.be.false;

    // Request parent tile next to the initial one, so 9,6,5, a server quest should be made.
    const nextParentTile = QuadId.createFromContentId("9_5_6");
    available = await tileMap.getChildrenAvailability(nextParentTile.getChildIds());
    const requestTile2 = getRequestTile(nextParentTile, tileMap.tileMapRequestSize);
    expect(getTileMapStub.calledWithExactly(requestTile2.level, requestTile2.row, requestTile2.column, tileMap.tileMapRequestSize,tileMap.tileMapRequestSize)).to.be.true;
  });

  it("Test 4x4 tilemap request, using call queue", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset1.tilemap;
    });

    const parentQuadId = QuadId.createFromContentId(dataset1.parentContentId);

    const tileMap = new ArcGISTileMap(fakeArcGisUrl, 24);
    tileMap.tileMapRequestSize = 4;
    const available = await tileMap.getChildrenAvailability(parentQuadId.getChildIds());

    expect(available).to.eql(dataset1.available);

    // Make sure that tile [10,10,10] was put in the middle of tilemap, so the request tile should be [10,9,9], size: 4x4
    const requestTile1 = getRequestTile(parentQuadId, tileMap.tileMapRequestSize);
    expect(getTileMapStub.calledWithExactly(requestTile1.level, requestTile1.row, requestTile1.column, tileMap.tileMapRequestSize,tileMap.tileMapRequestSize)).to.be.true;

  });

  // Since the parent tile is located on the top-left corner of the LOD,
  // no offset should be applied the requested tile (i.e we should not end up with negatives values for row,columns)
  it("Test 4x4 tilemap request, top-left tile of LOD", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset3.tilemap;
    });

    const parentQuadId = QuadId.createFromContentId(dataset3.parentContentId);

    const tileMap = new ArcGISTileMap(fakeArcGisUrl, 24);
    tileMap.tileMapRequestSize = 4;
    const available = await tileMap.getChildrenAvailability(parentQuadId.getChildIds());

    expect(available).to.eql(dataset3.available);

    const requestTile1 = getRequestTile(parentQuadId, tileMap.tileMapRequestSize);
    expect(getTileMapStub.calledWithExactly(requestTile1.level, requestTile1.row, requestTile1.column, tileMap.tileMapRequestSize,tileMap.tileMapRequestSize)).to.be.true;

  });

  // Response contains an adjusted tilemap, tiles we are looking for are still part
  // tile map, we need to make sure we can still get the tight tiles visibility.
  it("Test 4x4 tilemap request, response got adjusted to 3x3", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset2.tilemap;
    });

    const tileMap = new ArcGISTileMap(fakeArcGisUrl);
    tileMap.tileMapRequestSize = 4;
    const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset2.parentContentId).getChildIds());
    expect(getTileMapStub.calledOnce).to.be.true;
    expect(available).to.eql(dataset2.available);
  });

  // Response contains an adjusted tilemap, tiles we were looking for got clipped:
  // As a fallback, a second request should be made with a smaller tilemap should be made
  it("Test 4x4 tilemap request, response got adjusted to 2x2", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset4.tilemap;
    });

    const tileMap = new ArcGISTileMap(fakeArcGisUrl);
    tileMap.tileMapRequestSize = 4;
    const parentQuadId = QuadId.createFromContentId(dataset4.parentContentId);
    const available = await tileMap.getChildrenAvailability(parentQuadId.getChildIds());
    expect(getTileMapStub.calledTwice).to.be.true;
    const requestTile = getRequestTile(parentQuadId, tileMap.fallbackTileMapRequestSize);

    expect(getTileMapStub.lastCall.calledWithExactly(requestTile.level, requestTile.row, requestTile.column, tileMap.fallbackTileMapRequestSize, tileMap.fallbackTileMapRequestSize)).to.be.true;
    expect(available).to.eql(dataset4.available);
  });

  // In this test, tilemap got adjusted and tiles we were looking for got clipped!
  // A second request should be made with a smaller tilemap.
  // The second request will return the 1x1 tilemap.  available array should have a single tile available.
  it("Test 4x4 tilemap request, response got adjusted to 1x1", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset5.tilemap;  // always returns an 1x1 tilemap
    });

    const tileMap = new ArcGISTileMap(fakeArcGisUrl);
    tileMap.tileMapRequestSize = 4;
    const parentQuadId = QuadId.createFromContentId(dataset4.parentContentId);
    const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset4.parentContentId).getChildIds());
    expect(getTileMapStub.calledTwice).to.be.true;
    expect(available).to.eql([true,false,false,false]);
    const requestTile1 = getRequestTile(parentQuadId, tileMap.tileMapRequestSize);
    expect(getTileMapStub.getCalls()[0].calledWithExactly(requestTile1.level, requestTile1.row, requestTile1.column, tileMap.tileMapRequestSize, tileMap.tileMapRequestSize)).to.be.true;

    // Second tilemap request should have the fallbackTileMapRequestSize size, and no offset applied
    const requestTile2 = getRequestTile(parentQuadId);
    expect(getTileMapStub.getCalls()[1].calledWithExactly(requestTile2.level, requestTile2.row, requestTile2.column, tileMap.fallbackTileMapRequestSize, tileMap.fallbackTileMapRequestSize)).to.be.true;

    // When fallbackTileMapRequestSize is the same as the tileMapRequestSize, no second request is made
    // Also no offset should be applied
    tileMap.fallbackTileMapRequestSize = tileMap.tileMapRequestSize;
    getTileMapStub.resetHistory();
    const available2 = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset4.parentContentId).getChildIds());
    expect(available2).to.eql([true,false,false,false]);
    expect(getTileMapStub.calledOnce).to.be.true;
    // Tilemap request should have the fallbackTileMapRequestSize size, and no offset applied
    expect(getTileMapStub.calledWithExactly(requestTile2.level, requestTile2.row, requestTile2.column, tileMap.fallbackTileMapRequestSize, tileMap.fallbackTileMapRequestSize)).to.be.true;

  });

  it("Test empty tilemap response", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return emptyBundleError;
    });

    const allFalse = [false,false,false,false];
    const tileMap = new ArcGISTileMap(fakeArcGisUrl);
    tileMap.tileMapRequestSize = 4;
    const available = await tileMap.getChildrenAvailability(QuadId.createFromContentId(dataset2.parentContentId).getChildIds());
    expect(getTileMapStub.calledOnce).to.be.true;
    expect(available).to.eql(allFalse);

    const children = QuadId.createFromContentId(dataset1.parentContentId).getChildIds();
    const tileInfo = (tileMap as any).getAvailableTilesFromCache(children);
    expect(tileInfo.allTilesFound).to.be.true;
    expect(tileInfo.available).to.eql(allFalse);
  });

  it("Test 8x8 tilemap request", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset6.tilemap;
    });
    const parentQuadId = QuadId.createFromContentId(dataset6.parentContentId1);
    const tileMap = new ArcGISTileMap(fakeArcGisUrl);
    tileMap.tileMapRequestSize = 8;
    let available = await tileMap.getChildrenAvailability(parentQuadId.getChildIds());
    expect(available).to.eql(dataset6.available1);
    expect(getTileMapStub.calledOnce).to.be.true;

    // Make sure the request tile was put in the middle of the tilemap
    const requestTile1 = getRequestTile(parentQuadId, tileMap.tileMapRequestSize);
    expect(getTileMapStub.calledWithExactly(requestTile1.level, requestTile1.row, requestTile1.column, tileMap.tileMapRequestSize, tileMap.tileMapRequestSize)).to.be.true;

    // Request parent tile next to the initial one (on the right), only the bottom,right child should exist
    // no server request should be made
    getTileMapStub.resetHistory();
    const reqParentTile2 = QuadId.createFromContentId(dataset6.parentContentId2);
    expect(getTileMapStub.called).to.be.false;
    available = await tileMap.getChildrenAvailability(reqParentTile2.getChildIds());
    expect(available).to.eql(dataset6.available2);
    expect(getTileMapStub.calledOnce).to.be.false;
  });
});

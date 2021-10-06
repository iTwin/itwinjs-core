/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { expect } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";

import {
  ArcGISTileMap, QuadId,
} from "../../../tile/internal";

chai.use(chaiAsPromised);

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

// 8x8 dataset, 2 parent tiles are visible in the same tilemap
// the second one is only half visible
const dataset3 = {
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

  const getRequestTile = (parentTile: QuadId, tileMapRequestSize: number) => {
    const childRow = parentTile.row * 2;
    const childColumn = parentTile.column * 2;
    const childLevel = parentTile.level + 1;
    const offset = (tileMapRequestSize/2.0)-1;
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

    const tileMap = new ArcGISTileMap("https:localhost/test/rest");
    tileMap.tileMapRequestSize = 4;
    let available = await tileMap.getChildrenVisibility(parentQuadId);

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
    available = await tileMap.getChildrenVisibility(QuadId.createFromContentId(dataset1.parentContentId));
    expect(tileInfo.allTilesFound).to.be.true;
    expect(available).to.eql(dataset1.available);
    expect(getTileMapStub.called).to.be.false;

    // Request parent tile next to the initial one, so 9,6,5, a server quest should be made.
    const nextParentTile = QuadId.createFromContentId("9_5_6");
    available = await tileMap.getChildrenVisibility(nextParentTile);
    const requestTile2 = getRequestTile(nextParentTile, tileMap.tileMapRequestSize);
    expect(getTileMapStub.calledWithExactly(requestTile2.level, requestTile2.row, requestTile2.column, tileMap.tileMapRequestSize,tileMap.tileMapRequestSize)).to.be.true;
  });

  it("Test 4x4 tilemap request, response got adjusted to 3x3", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset2.tilemap;
    });

    const tileMap = new ArcGISTileMap("https:localhost/test/rest");
    tileMap.tileMapRequestSize = 4;
    const available = await tileMap.getChildrenVisibility(QuadId.createFromContentId(dataset2.parentContentId));
    expect(getTileMapStub.calledOnce).to.be.true;
    expect(available).to.eql(dataset2.available);
  });

  it("Test empty tilemap response", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return emptyBundleError;
    });

    const allFalse = [false,false,false,false];
    const tileMap = new ArcGISTileMap("https:localhost/test/rest");
    tileMap.tileMapRequestSize = 4;
    const available = await tileMap.getChildrenVisibility(QuadId.createFromContentId(dataset2.parentContentId));
    expect(getTileMapStub.calledOnce).to.be.true;
    expect(available).to.eql(allFalse);

    const children = QuadId.createFromContentId(dataset1.parentContentId).getChildIds();
    const tileInfo = (tileMap as any).getAvailableTilesFromCache(children);
    expect(tileInfo.allTilesFound).to.be.true;
    expect(tileInfo.available).to.eql(allFalse);
  });

  it("Test 8x8 tilemap request", async () => {

    const getTileMapStub = sandbox.stub(ArcGISTileMap.prototype, "fetchTileMapFromServer" as any).callsFake(async function _(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any>  {
      return dataset3.tilemap;
    });
    const parentQuadId = QuadId.createFromContentId(dataset3.parentContentId1);
    const tileMap = new ArcGISTileMap("https:localhost/test/rest");
    tileMap.tileMapRequestSize = 8;
    let available = await tileMap.getChildrenVisibility(parentQuadId);
    expect(available).to.eql(dataset3.available1);
    expect(getTileMapStub.calledOnce).to.be.true;

    // Make sure the request tile was put in the middle of the tilemap
    const requestTile1 = getRequestTile(parentQuadId, tileMap.tileMapRequestSize);
    expect(getTileMapStub.calledWithExactly(requestTile1.level, requestTile1.row, requestTile1.column, tileMap.tileMapRequestSize, tileMap.tileMapRequestSize)).to.be.true;

    // Request parent tile next to the initial one (on the right), only the bottom,right child should exist
    // no server request should be made
    getTileMapStub.resetHistory();
    const reqParentTile2 = QuadId.createFromContentId(dataset3.parentContentId2);
    expect(getTileMapStub.called).to.be.false;
    available = await tileMap.getChildrenVisibility(reqParentTile2);
    expect(available).to.eql(dataset3.available2);
    expect(getTileMapStub.calledOnce).to.be.false;
  });
});

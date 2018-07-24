/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { WebGLTestContext } from "../WebGLTestContext";
import { PerformanceWriterClient } from "./PerformanceWriterClient";

describe("PerformanceTests", () => {
  before(() => {
    WebGLTestContext.startup();
  });
  after(() => WebGLTestContext.shutdown());

  it("/////////////////////////////////////////////////////////////////", () => {
    if (WebGLTestContext.isInitialized) {
      // testCreateGeometry();
    }
    // const fileName = "C:\\Files\\test.xlsx";
    // const sheetName = "Sheet1";
    // const app = Sys.OleObject("Excel.Application")
    // app.Visible = "True";

    // const excel = new ActiveXObject("Excel.Application");
    // excel.Visible = true;
    // excel.Workbooks.Open("test.xlsx");
  });
});

import { assert, expect } from "chai";
import { ColorMap } from "@bentley/imodeljs-frontend/lib/rendering";
import { ColorDef, ColorIndex } from "@bentley/imodeljs-common";

describe("ColorMap", () => {
  it("create a new ColorMap", async () => {
    // console.log(response); //tslint:disable-line
    async function run() {
      try {
        await PerformanceWriterClient.startup();
        await PerformanceWriterClient.addEntry({
          imodelName: "test",
          viewName: "test",
          viewFlags: "test",
          data: {
            tileLoadingTime: 1,
            scene: 2,
            garbageExecute: 3,
            initCommands: 4,
            backgroundDraw: 5,
            setClips: 6,
            opaqueDraw: 7,
            translucentDraw: 8,
            hiliteDraw: 9,
            compositeDraw: 10,
            overlayDraw: 11,
            renderFrameTime: 12,
            glFinish: 13,
            totalTime: 14,
          },
        });
        await PerformanceWriterClient.addEntry({
          imodelName: "test",
          viewName: "test",
          viewFlags: "test",
          data: {
            tileLoadingTime: 11,
            scene: 12,
            garbageExecute: 13,
            initCommands: 14,
            backgroundDraw: 15,
            setClips: 16,
            opaqueDraw: 17,
            translucentDraw: 18,
            hiliteDraw: 19,
            compositeDraw: 110,
            overlayDraw: 111,
            renderFrameTime: 112,
            glFinish: 113,
            totalTime: 1411,
          },
        });
        await PerformanceWriterClient.addEntry({
          imodelName: "test",
          viewName: "test",
          viewFlags: "test",
          data: {
            tileLoadingTime: 21,
            scene: 22,
            garbageExecute: 23,
            initCommands: 24,
            backgroundDraw: 25,
            setClips: 26,
            opaqueDraw: 27,
            translucentDraw: 28,
            hiliteDraw: 29,
            compositeDraw: 20,
            overlayDraw: 121,
            renderFrameTime: 122,
            glFinish: 213,
            totalTime: 124,
          },
        });
      } catch (ex) {
        console.log(ex); // tslint:disable-line
      }

      await PerformanceWriterClient.finishSeries();
    }

    await run();

    /** Test creating a ColorMap */
    const a: ColorMap = new ColorMap();
    expect(a.length).to.equal(0);
    expect(a.hasTransparency).to.be.false;
  });

  it("test insert function", () => {
    /** Test static getMaxIndex function */
    const a: ColorMap = new ColorMap();
    assert.isTrue(a.insert(0xFF0000) === 0);
    assert.isTrue(a.length === 1);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0x0000FF) === 1);
    assert.isTrue(a.length === 2);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0x0000FF) === 1);
    assert.isTrue(a.length === 2);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0xFF0000) === 0);
    assert.isTrue(a.length === 2);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0xFFFFFF) === 2);
    assert.isTrue(a.length === 3);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0x0000FF) === 1);
    assert.isTrue(a.length === 3);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0xFF0000) === 0);
    assert.isTrue(a.length === 3);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0xFFFFFF) === 2);
    assert.isTrue(a.length === 3);
    assert.isFalse(a.hasTransparency);
  });

  it("test simple return functions", () => {
    /** Test hasTransparency function */
    let a: ColorMap = new ColorMap();
    assert.isFalse(a.hasTransparency);
    a.insert(0x01000000);
    assert.isTrue(a.hasTransparency);
    a.insert(0xFF000000);
    assert.isTrue(a.hasTransparency);
    a.insert(0x7FFFFFFF);
    assert.isTrue(a.hasTransparency);
    a = new ColorMap();
    a.insert(0xFF000000);
    assert.isTrue(a.hasTransparency);
    a = new ColorMap();
    a.insert(0x7FFFFFFF);
    assert.isTrue(a.hasTransparency);
    a = new ColorMap();
    a.insert(0x00000000);
    assert.isFalse(a.hasTransparency);
    a = new ColorMap();
    a.insert(0x00FFFFFF);
    assert.isFalse(a.hasTransparency);
    let inserted = false;
    try { // try to insert a translucent color into a table which does not have transparency.
      a.insert(0x0F000000);
      inserted = true;
    } catch (err) {
      expect(err).is.not.undefined;
    }
    expect(inserted).to.be.false;

    /** Test isUniform function */
    a = new ColorMap();
    assert.isFalse(a.isUniform);
    a.insert(0xFF0000);
    assert.isTrue(a.isUniform);
    a.insert(0x00FF00);
    assert.isFalse(a.isUniform);
    a.insert(0x0000FF);
    assert.isFalse(a.isUniform);

    /** Test isFull function */
    a = new ColorMap();
    assert.isFalse(a.isFull);
    for (let i = 0; a.length !== 0xffff; i++) {
      assert.isFalse(a.isFull);
      a.insert(i);
    }
    assert.isTrue(a.length === 0xffff);
    assert.isTrue(a.isFull);

    /** Test getNumIndices function */
    a = new ColorMap();
    assert.isTrue(a.length === 0);
    for (let i = 0; a.length !== 0xffff; i++) {
      assert.isTrue(a.length === i);
      a.insert(i);
    }
    assert.isTrue(a.length === 0xffff);

    /** Test size function */
    a = new ColorMap();
    assert.isTrue(a.length === 0);
    for (let i = 0; a.length !== 0xffff; i++) {
      assert.isTrue(a.length === i);
      a.insert(i);
    }
    assert.isTrue(a.length === 0xffff);

    /** Test empty function */
    a = new ColorMap();
    assert.isTrue(a.isEmpty);
    a.insert(0x00FFFF);
    assert.isFalse(a.isEmpty);
    a.insert(0xFFFF00);
    assert.isFalse(a.isEmpty);
    a.insert(0xFFFFFF);
    assert.isFalse(a.isEmpty);
  });

  it("test toColorIndex function", () => {
    /** Test toColorIndex function */
    let a: ColorMap = new ColorMap();
    const uint16: Uint16Array = new Uint16Array(2);
    let colorIndex = new ColorIndex();

    a.insert(0xFFFFFF);
    a.toColorIndex(colorIndex, uint16);
    expect(colorIndex.uniform!.tbgr).to.equal(0xFFFFFF);
    assert.isTrue(colorIndex.numColors === 1);

    a = new ColorMap();
    colorIndex = new ColorIndex();
    expect(colorIndex.uniform!.tbgr).to.equal(ColorDef.white.tbgr);
    assert.isTrue(colorIndex.numColors === 1);
    a.insert(0x0000FFFF);
    a.toColorIndex(colorIndex, uint16);
    expect(colorIndex.isUniform).to.equal(true);
    assert.isTrue(colorIndex.uniform!.tbgr === 0x0000FFFF);
    assert.isTrue(colorIndex.numColors === 1);

    a = new ColorMap();
    a.insert(0x0000FFFF);
    a.insert(0x000000FF);
    colorIndex = new ColorIndex();
    colorIndex.initUniform(0x00FF00FF);
    assert.isTrue(colorIndex.numColors === 1);
    a.toColorIndex(colorIndex, uint16);
    assert.isFalse(colorIndex.isUniform);
    assert.isTrue(colorIndex.nonUniform && colorIndex.nonUniform.colors.length === 2);
    let values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
    assert.isTrue(values && values.next().value === 0x0000FFFF);
    assert.isTrue(values && values.next().value === 0x000000FF);
    assert.isTrue(values && values.next().done);
    assert.isTrue(colorIndex.numColors === 2);

    a = new ColorMap();
    a.insert(0x00000000);
    a.insert(0x0000FFFF);
    a.insert(0x000000FF);
    colorIndex = new ColorIndex();
    assert.isTrue(colorIndex.numColors === 1);
    a.toColorIndex(colorIndex, uint16);
    assert.isFalse(colorIndex.isUniform);
    assert.isTrue(colorIndex.nonUniform && colorIndex.nonUniform.colors.length === 3);
    values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
    assert.isTrue(values && values.next().value === 0x00000000);
    assert.isTrue(values && values.next().value === 0x0000FFFF);
    assert.isTrue(values && values.next().value === 0x000000FF);
    assert.isTrue(values && values.next().done);
    assert.isTrue(colorIndex.numColors === 3);
  });
});

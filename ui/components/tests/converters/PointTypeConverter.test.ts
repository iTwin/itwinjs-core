/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point2dTypeConverter, Point3dTypeConverter } from "../../src/index";
import TestUtils from "../TestUtils";

describe("Point2dTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: Point2dTypeConverter;

  beforeEach(() => {
    converter = new Point2dTypeConverter();
  });

  it("convertToString", async () => {
    expect(await converter.convertToString([50, 100])).to.equal("50, 100");
  });

  it("convertToString passed invalid values", async () => {
    expect(await converter.convertToString(null)).to.equal("");
    expect(await converter.convertToString(1)).to.equal("");
  });

  it("convertFromString", async () => {
    const point2d = await converter.convertFromString("50, 100");
    expect(point2d.x).to.equal("50");
    expect(point2d.y).to.equal("100");
  });

  it("convertFromString passed invalid values", async () => {
    expect(await converter.convertFromString((null as any))).to.be.undefined;
    expect(await converter.convertFromString((undefined as any))).to.be.undefined;
    expect(await converter.convertFromString("50, 100, 150")).to.be.undefined;
  });

});

describe("Point3dTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: Point3dTypeConverter;

  beforeEach(() => {
    converter = new Point3dTypeConverter();
  });

  it("convertToString", async () => {
    expect(await converter.convertToString([50, 100, 150])).to.equal("50, 100, 150");
  });

  it("convertToString passed invalid values", async () => {
    expect(await converter.convertToString(null)).to.equal("");
    expect(await converter.convertToString(1)).to.equal("");
  });

  it("convertFromString", async () => {
    const point3d = await converter.convertFromString("50, 100, 150");
    expect(point3d.x).to.equal("50");
    expect(point3d.y).to.equal("100");
    expect(point3d.z).to.equal("150");
  });

  it("convertFromString passed invalid values", async () => {
    expect(await converter.convertFromString((null as any))).to.be.undefined;
    expect(await converter.convertFromString((undefined as any))).to.be.undefined;
    expect(await converter.convertFromString("50, 100")).to.be.undefined;
  });

});

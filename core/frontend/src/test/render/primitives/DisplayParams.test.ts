/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorByName, ColorDef, GraphicParams, LinePixels } from "@itwin/core-common";
import { DisplayParams } from "../../../render/primitives/DisplayParams";

export class FakeDisplayParams extends DisplayParams {
  public constructor() { super(DisplayParams.Type.Linear, ColorDef.black, ColorDef.black); }
}

describe("DisplayParams creation tests", () => {
  it("should create mesh DisplayParams and be of type mesh", () => {
    const gf: GraphicParams = new GraphicParams();
    const dp: DisplayParams = DisplayParams.createForMesh(gf, false);
    expect(dp.type).to.equal(DisplayParams.Type.Mesh);
  });

  it("should create linear DisplayParams and be of type linear", () => {
    const gf: GraphicParams = new GraphicParams();
    const dp: DisplayParams = DisplayParams.createForLinear(gf);
    expect(dp.type).to.equal(DisplayParams.Type.Linear);
  });

  it("should create text DisplayParams and be of type text", () => {
    const gf: GraphicParams = new GraphicParams();
    const dp: DisplayParams = DisplayParams.createForText(gf);
    expect(dp.type).to.equal(DisplayParams.Type.Text);
  });
});

describe("DisplayParams equality tests", () => {
  it("two DisplayParams created from two default GraphicParams should be equal", () => {
    const gf0: GraphicParams = new GraphicParams();
    const gf1: GraphicParams = new GraphicParams();
    const dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0, false);
    const dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1, false);
    expect(dpMesh0.equals(dpMesh1)).to.be.true;
    const dpText0: DisplayParams = DisplayParams.createForText(gf0);
    const dpText1: DisplayParams = DisplayParams.createForText(gf1);
    expect(dpText0.equals(dpText1)).to.be.true;
    const dpLinear0: DisplayParams = DisplayParams.createForLinear(gf0);
    const dpLinear1: DisplayParams = DisplayParams.createForLinear(gf1);
    expect(dpLinear0.equals(dpLinear1)).to.be.true;
  });

  it("two DisplayParams created with different colors should be non-equal", () => {
    const gf0: GraphicParams = new GraphicParams(); gf0.lineColor = ColorDef.white;
    const gf1: GraphicParams = new GraphicParams(); gf1.lineColor = ColorDef.black;
    const dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0, false);
    const dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1, false);
    expect(dpMesh0.equals(dpMesh1)).to.be.false;
    const dpText0: DisplayParams = DisplayParams.createForText(gf0);
    const dpText1: DisplayParams = DisplayParams.createForText(gf1);
    expect(dpText0.equals(dpText1)).to.be.false;
    const dpLinear0: DisplayParams = DisplayParams.createForLinear(gf0);
    const dpLinear1: DisplayParams = DisplayParams.createForLinear(gf1);
    expect(dpLinear0.equals(dpLinear1)).to.be.false;
  });

  it("two DisplayParams created with different colors (same alpha) should be equal if merge-comparing", () => {
    const cd0: ColorDef = ColorDef.create(ColorByName.white).withAlpha(64);
    const cd1: ColorDef = ColorDef.create(ColorByName.black).withAlpha(64);
    const gf0: GraphicParams = new GraphicParams(); gf0.lineColor = cd0;
    const gf1: GraphicParams = new GraphicParams(); gf1.lineColor = cd1;
    const dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0, false);
    const dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1, false);
    expect(dpMesh0.equals(dpMesh1, DisplayParams.ComparePurpose.Merge)).to.be.true;
    const dpLinear0: DisplayParams = DisplayParams.createForMesh(gf0, false);
    const dpLinear1: DisplayParams = DisplayParams.createForMesh(gf1, false);
    expect(dpLinear0.equals(dpLinear1, DisplayParams.ComparePurpose.Merge)).to.be.true;
    const dpText0: DisplayParams = DisplayParams.createForMesh(gf0, false);
    const dpText1: DisplayParams = DisplayParams.createForMesh(gf1, false);
    expect(dpText0.equals(dpText1, DisplayParams.ComparePurpose.Merge)).to.be.true;
  });

  it("two DisplayParams created with different types should be non-equal", () => {
    const gf: GraphicParams = new GraphicParams();
    const dp0: DisplayParams = DisplayParams.createForLinear(gf);
    const dp1: DisplayParams = DisplayParams.createForMesh(gf, false);
    expect(dp0.equals(dp1)).to.be.false;
  });

  it("two DisplayParams created with different symbology should be non-equal", () => {
    const gf0: GraphicParams = GraphicParams.fromSymbology(ColorDef.white, ColorDef.black, 8, LinePixels.Solid);
    const gf1: GraphicParams = GraphicParams.fromSymbology(ColorDef.white, ColorDef.black, 3, LinePixels.HiddenLine);
    const dp0: DisplayParams = DisplayParams.createForMesh(gf0, false);
    const dp1: DisplayParams = DisplayParams.createForMesh(gf1, false);
    expect(dp0.equals(dp1)).to.be.false;
  });
});

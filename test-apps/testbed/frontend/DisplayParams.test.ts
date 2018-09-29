/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GraphicParams, ColorDef, ColorByName, LinePixels } from "@bentley/imodeljs-common";
import { DisplayParams } from "@bentley/imodeljs-frontend/lib/rendering";

export class FakeDisplayParams extends DisplayParams {
  public constructor() { super(DisplayParams.Type.Linear, new ColorDef(), new ColorDef()); }
}

describe("DisplayParams creation tests", () => {
  it("should create mesh DisplayParams and be of type mesh", () => {
    const gf: GraphicParams = new GraphicParams();
    const dp: DisplayParams = DisplayParams.createForMesh(gf);
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
    const dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0);
    const dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpMesh0.equals(dpMesh1)).to.be.true;
    const dpText0: DisplayParams = DisplayParams.createForText(gf0);
    const dpText1: DisplayParams = DisplayParams.createForText(gf1);
    expect(dpText0.equals(dpText1)).to.be.true;
    const dpLinear0: DisplayParams = DisplayParams.createForLinear(gf0);
    const dpLinear1: DisplayParams = DisplayParams.createForLinear(gf1);
    expect(dpLinear0.equals(dpLinear1)).to.be.true;
  });

  it("two DisplayParams created with different colors should be non-equal", () => {
    const gf0: GraphicParams = new GraphicParams(); gf0.setLineColor(ColorDef.white);
    const gf1: GraphicParams = new GraphicParams(); gf1.setLineColor(ColorDef.black);
    const dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0);
    const dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpMesh0.equals(dpMesh1)).to.be.false;
    const dpText0: DisplayParams = DisplayParams.createForText(gf0);
    const dpText1: DisplayParams = DisplayParams.createForText(gf1);
    expect(dpText0.equals(dpText1)).to.be.false;
    const dpLinear0: DisplayParams = DisplayParams.createForLinear(gf0);
    const dpLinear1: DisplayParams = DisplayParams.createForLinear(gf1);
    expect(dpLinear0.equals(dpLinear1)).to.be.false;
  });

  it("two DisplayParams created with different colors (same alpha) should be equal if merge-comparing", () => {
    const cd0: ColorDef = new ColorDef(ColorByName.white); cd0.setAlpha(64);
    const cd1: ColorDef = new ColorDef(ColorByName.black); cd1.setAlpha(64);
    const gf0: GraphicParams = new GraphicParams(); gf0.setLineColor(cd0);
    const gf1: GraphicParams = new GraphicParams(); gf1.setLineColor(cd1);
    const dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0);
    const dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpMesh0.equals(dpMesh1, DisplayParams.ComparePurpose.Merge)).to.be.true;
    const dpLinear0: DisplayParams = DisplayParams.createForMesh(gf0);
    const dpLinear1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpLinear0.equals(dpLinear1, DisplayParams.ComparePurpose.Merge)).to.be.true;
    const dpText0: DisplayParams = DisplayParams.createForMesh(gf0);
    const dpText1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpText0.equals(dpText1, DisplayParams.ComparePurpose.Merge)).to.be.true;
  });

  it("two DisplayParams created with different types should be non-equal", () => {
    const gf: GraphicParams = new GraphicParams();
    const dp0: DisplayParams = DisplayParams.createForLinear(gf);
    const dp1: DisplayParams = DisplayParams.createForMesh(gf);
    expect(dp0.equals(dp1)).to.be.false;
  });

  it("two DisplayParams created with different symbology should be non-equal", () => {
    const gf0: GraphicParams = GraphicParams.fromSymbology(ColorDef.white, ColorDef.black, 8, LinePixels.Solid);
    const gf1: GraphicParams = GraphicParams.fromSymbology(ColorDef.white, ColorDef.black, 3, LinePixels.HiddenLine);
    const dp0: DisplayParams = DisplayParams.createForMesh(gf0);
    const dp1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dp0.equals(dp1)).to.be.false;
  });
});

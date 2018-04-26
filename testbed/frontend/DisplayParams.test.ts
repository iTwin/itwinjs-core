/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { DisplayParams, DisplayParamsType, DisplayParamsComparePurpose } from "@bentley/imodeljs-frontend/lib/rendering";
import { GraphicParams, ColorDef, ColorByName, LinePixels } from "@bentley/imodeljs-common";

describe("DisplayParams creation tests", () => {
  it("should create mesh DisplayParams and be of type mesh", () => {
    let gf: GraphicParams = new GraphicParams();
    let dp: DisplayParams = DisplayParams.createForMesh(gf);
    expect(dp.type).to.equal(DisplayParamsType.Mesh)
  });

  it("should create linear DisplayParams and be of type linear", () => {
    let gf: GraphicParams = new GraphicParams();
    let dp: DisplayParams = DisplayParams.createForLinear(gf);
    expect(dp.type).to.equal(DisplayParamsType.Linear)
  });

  it("should create text DisplayParams and be of type text", () => {
    let gf: GraphicParams = new GraphicParams();
    let dp: DisplayParams = DisplayParams.createForText(gf);
    expect(dp.type).to.equal(DisplayParamsType.Text)
  });
});

describe("DisplayParams equality tests", () => {
  it("two DisplayParams created from two default GraphicParams should be equal", () => {
    let gf0: GraphicParams = new GraphicParams();
    let gf1: GraphicParams = new GraphicParams();
    let dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0);
    let dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpMesh0.equals(dpMesh1)).to.be.true;
    let dpText0: DisplayParams = DisplayParams.createForText(gf0);
    let dpText1: DisplayParams = DisplayParams.createForText(gf1);
    expect(dpText0.equals(dpText1)).to.be.true;
    let dpLinear0: DisplayParams = DisplayParams.createForLinear(gf0);
    let dpLinear1: DisplayParams = DisplayParams.createForLinear(gf1);
    expect(dpLinear0.equals(dpLinear1)).to.be.true;
  });

  it("two DisplayParams created with different colors should be non-equal", () => {
    let gf0: GraphicParams = new GraphicParams();  gf0.setLineColor(ColorDef.white);
    let gf1: GraphicParams = new GraphicParams();  gf1.setLineColor(ColorDef.black);
    let dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0);
    let dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpMesh0.equals(dpMesh1)).to.be.false;
    let dpText0: DisplayParams = DisplayParams.createForText(gf0);
    let dpText1: DisplayParams = DisplayParams.createForText(gf1);
    expect(dpText0.equals(dpText1)).to.be.false;
    let dpLinear0: DisplayParams = DisplayParams.createForLinear(gf0);
    let dpLinear1: DisplayParams = DisplayParams.createForLinear(gf1);
    expect(dpLinear0.equals(dpLinear1)).to.be.false;
  });

  it("two DisplayParams created with different colors (same alpha) should be equal if merge-comparing", () => {
    let cd0: ColorDef = new ColorDef(ColorByName.white);  cd0.setAlpha(64);
    let cd1: ColorDef = new ColorDef(ColorByName.black);  cd1.setAlpha(64);
    let gf0: GraphicParams = new GraphicParams();  gf0.setLineColor(cd0);
    let gf1: GraphicParams = new GraphicParams();  gf1.setLineColor(cd1);
    let dpMesh0: DisplayParams = DisplayParams.createForMesh(gf0);
    let dpMesh1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpMesh0.equals(dpMesh1, DisplayParamsComparePurpose.Merge)).to.be.true;
    let dpLinear0: DisplayParams = DisplayParams.createForMesh(gf0);
    let dpLinear1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpLinear0.equals(dpLinear1, DisplayParamsComparePurpose.Merge)).to.be.true;
    let dpText0: DisplayParams = DisplayParams.createForMesh(gf0);
    let dpText1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dpText0.equals(dpText1, DisplayParamsComparePurpose.Merge)).to.be.true;
  });

  it("two DisplayParams created with different types should be non-equal", () => {
    let gf: GraphicParams = new GraphicParams();
    let dp0: DisplayParams = DisplayParams.createForLinear(gf);
    let dp1: DisplayParams = DisplayParams.createForMesh(gf);
    expect(dp0.equals(dp1)).to.be.false;
  });

  it("two DisplayParams created with different symbology should be non-equal", () => {
    let gf0: GraphicParams = GraphicParams.fromSymbology(ColorDef.white, ColorDef.black, 8, LinePixels.Solid);
    let gf1: GraphicParams = GraphicParams.fromSymbology(ColorDef.white, ColorDef.black, 3, LinePixels.HiddenLine);
    let dp0: DisplayParams = DisplayParams.createForMesh(gf0);
    let dp1: DisplayParams = DisplayParams.createForMesh(gf1);
    expect(dp0.equals(dp1)).to.be.false;
  });
});

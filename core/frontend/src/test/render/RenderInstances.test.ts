/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point2d, Range3d, Transform } from "@itwin/core-geometry";
import { RenderInstancesParamsBuilder } from "../../common/render/RenderInstancesParams";
import { Id64 } from "@itwin/core-bentley";
import { RenderInstancesParamsImpl } from "../../internal/render/RenderInstancesParamsImpl";
import { InstancedGraphicPropsBuilder } from "../../common/internal/render/InstancedGraphicPropsBuilder";
import { InstancedGraphicParams, InstancedGraphicProps } from "../../common/render/InstancedGraphicParams";
import { InstanceBuffers, InstanceBuffersData } from "../../render/webgl/InstancedGeometry";
import { IModelApp } from "../../IModelApp";
import { ColorDef, EmptyLocalization, LinePixels, ModelFeature } from "@itwin/core-common";
import { GraphicType, ViewRect } from "../../common";
import { Color, openBlankViewport, readUniqueColors, readUniquePixelData } from "../openBlankViewport";
import { GraphicBranch } from "../../core-frontend";
import { _featureTable } from "../../common/internal/Symbols";

describe("RenderInstancesParamsBuilder", () => {
  it("throws if no instances supplied", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    expect(() => builder.finish()).to.throw("No instances defined");
  });

  it("populates feature table IFF features are present", () => {
    let builder = RenderInstancesParamsBuilder.create({});
    const reset = () => {
      builder = RenderInstancesParamsBuilder.create({});
    };
    const addInstance = (feature?: string) => {
      builder.add({ transform: Transform.createIdentity(), feature });
    };

    const finish = () => builder.finish() as RenderInstancesParamsImpl;
    addInstance();
    expect(finish().features).to.be.undefined;

    reset();
    addInstance(Id64.invalid);
    expect(finish().features).not.to.be.undefined;

    reset();
    addInstance("0x123");
    expect(finish().features).not.to.be.undefined;

    reset();
    addInstance();
    addInstance("0x123");
    addInstance(Id64.invalid);
    expect(finish().features).not.to.be.undefined;
  });
});

describe("InstanceBuffers", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  function makeInstances(): InstancedGraphicProps {
    const builder = new InstancedGraphicPropsBuilder();
    builder.add({ transform: Transform.createIdentity() });
    return builder.finish(undefined);
  }

  it("releases WebGL resources in dispose method unless explicitly specified", () => {
    const instances = makeInstances();
    const a = InstanceBuffersData.create(instances)!;
    const b = InstanceBuffersData.create(instances, false)!;
    const c = InstanceBuffersData.create(instances, true)!;
    expect(a.isDisposed).to.be.false;
    expect(b.isDisposed).to.be.false;
    expect(c.isDisposed).to.be.false;

    a.dispose();
    b.dispose();
    c.dispose();
    expect(a.isDisposed).to.be.true;
    expect(b.isDisposed).to.be.true;
    expect(c.isDisposed).to.be.false;
  });

  it("are disposable when creating from InstancedGraphicParams", () => {
    const params = InstancedGraphicParams.fromProps(makeInstances());
    const buffers = InstanceBuffers.fromParams(params, () => new Range3d())!;
    expect(buffers.isDisposed).to.be.false;

    buffers.dispose();
    expect(buffers.isDisposed).to.be.true;
  });

  it("are non-disposable when created from RenderInstances", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    builder.add({ transform: Transform.createIdentity() });
    const params = builder.finish();

    const instances = IModelApp.renderSystem.createRenderInstances(params)!;
    const buffers = InstanceBuffers.fromRenderInstances(instances, new Range3d());
    expect(buffers.isDisposed).to.be.false;

    buffers.dispose();
    expect(buffers.isDisposed).to.be.false;
  });
});

describe.only("RenderInstances", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  it("populates feature table", () => {
    const paramsBuilder = RenderInstancesParamsBuilder.create({ modelId: "0xf" });
    paramsBuilder.add({ feature: "0x1", transform: Transform.createIdentity() });
    paramsBuilder.add({ feature: "0x2", transform: Transform.createIdentity() });
    paramsBuilder.add({ feature: "0x3", transform: Transform.createIdentity() });
    paramsBuilder.add({ feature: "0x4", transform: Transform.createIdentity() });
    const params = paramsBuilder.finish();

    const instances = IModelApp.renderSystem.createRenderInstances(params)!;
    expect(instances).not.to.be.undefined;

    const ft = instances[_featureTable]!;
    expect(ft).not.to.be.undefined;
    expect(ft.numFeatures).to.equal(4);
    expect(ft.batchModelId).to.equal("0xf");

    const feat = ModelFeature.create();
    expect(ft.findFeature(0, feat)?.elementId).to.equal("0x1");
    expect(ft.findFeature(1, feat)?.elementId).to.equal("0x2");
    expect(ft.findFeature(2, feat)?.elementId).to.equal("0x3");
    expect(ft.findFeature(3, feat)?.elementId).to.equal("0x4");
  });
  
  it("renders the same template with different positions, scales, features, and symbologies", () => {
    // Create a template of a red solid line 1 pixel tall and 5 pixels wide
    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.ViewOverlay,
      computeChordTolerance: () => 0,
    });

    builder.setSymbology(ColorDef.red, ColorDef.red, 1, LinePixels.Solid);
    //builder.addLineString2d([new Point2d(0, 0), new Point2d(5, 0)], 0);
    // builder.addShape2d([
    //   new Point2d(-5, -5),
    //   new Point2d(5, -5),
    //   new Point2d(5, 5),
    //   new Point2d(-5, 5),
    //   new Point2d(-5, -5),
    // ], 0);
    builder.addPointString2d([new Point2d(0, 0)], 0);
    const template = builder.finishTemplate();

    // Create 4 instances each in one of the corners of a 100x100-pixel viewport.
    const paramsBuilder = RenderInstancesParamsBuilder.create({});
    paramsBuilder.add({
      transform: Transform.createTranslationXYZ(25, -25, 0),
      feature: "0x1",
    });
    paramsBuilder.add({
      transform: Transform.createTranslationXYZ(25, 25, 0),
      feature: "0x2",
      symbology: { color: { r: 0, g: 0, b: 255 } },
    });
    paramsBuilder.add({
      transform: Transform.createTranslationXYZ(-25, 25, 0),
      feature: "0x3",
      symbology: { weight: 3 },
    });
    paramsBuilder.add({
      transform: Transform.createTranslationXYZ(-25, -25, 0),
      feature: "0x4",
      symbology: { linePixels: LinePixels.HiddenLine },
    });

    // Create a graphic from the template+instances, translated to the center of the viewport.
    const instances = IModelApp.renderSystem.createRenderInstances(paramsBuilder.finish())!;
    expect(instances).not.to.be.undefined;
    expect(instances[_featureTable]!.numFeatures).to.equal(4);
    
    let graphic = IModelApp.renderSystem.createGraphicFromTemplate({ template, instances });
    const branch = new GraphicBranch(false);
    branch.add(graphic);
    graphic = IModelApp.renderSystem.createBranch(branch, Transform.createTranslationXYZ(50, 50, 0));

    // Draw the instances into a viewport.
    IModelApp.viewManager.addDecorator({
      decorate: (context) => {
        context.addDecoration(GraphicType.ViewOverlay, graphic);
      },
    });

    const vp = openBlankViewport({ height: 100, width: 100 });
    vp.displayStyle.backgroundColor = ColorDef.black;
    vp.renderFrame();

    let colors = readUniqueColors(vp);
    expect(colors.length).to.equal(3);
    expect(colors.contains(Color.fromColorDef(ColorDef.black))).to.be.true;
    expect(colors.contains(Color.fromColorDef(ColorDef.red))).to.be.true;
    expect(colors.contains(Color.fromColorDef(ColorDef.blue))).to.be.true;

    let pixels = readUniquePixelData(vp);
    expect(pixels.length).to.equal(5);
    expect(pixels.containsElement("")).to.be.true;
    for (let i = 1; i <= 4; i++) {
      expect(pixels.containsElement(`0x${i}`)).to.be.true;
    }

    colors = readUniqueColors(vp, new ViewRect(50, 0, 100, 50));
    expect(colors.length).to.equal(2);
    expect(colors.contains(Color.fromColorDef(ColorDef.red))).to.be.true;
    pixels = readUniquePixelData(vp, new ViewRect(50, 0, 100, 50));


    
    vp.dispose();
  });
});

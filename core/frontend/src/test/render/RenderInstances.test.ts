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
import { ColorDef, EmptyLocalization, LinePixels } from "@itwin/core-common";
import { GraphicType } from "../../common";
import { Color, openBlankViewport, readUniqueColors } from "../openBlankViewport";
import { GraphicBranch } from "../../core-frontend";

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

  it("renders the same template with different positions, scales, features, and symbologies", () => {
    // Create a template of a red solid line 1 pixel tall and 5 pixels wide
    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.ViewOverlay,
      computeChordTolerance: () => 0,
    });

    builder.setSymbology(ColorDef.red, ColorDef.red, 1, LinePixels.Solid);
    builder.addLineString2d([new Point2d(0, 0), new Point2d(5, 0)], 0);
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

    const colors = readUniqueColors(vp);
    expect(colors.length).to.equal(3);
    expect(colors.contains(Color.fromColorDef(ColorDef.black))).to.be.true;
    expect(colors.contains(Color.fromColorDef(ColorDef.red))).to.be.true;
    expect(colors.contains(Color.fromColorDef(ColorDef.blue))).to.be.true;

    vp.dispose();
  });
});

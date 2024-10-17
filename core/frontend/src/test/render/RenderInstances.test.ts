/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Point2d, Range3d, Transform } from "@itwin/core-geometry";
import { RenderInstancesParamsBuilder } from "../../common/render/RenderInstancesParams";
import { Id64 } from "@itwin/core-bentley";
import { RenderInstancesParamsImpl } from "../../internal/render/RenderInstancesParamsImpl";
import { InstancedGraphicPropsBuilder } from "../../common/internal/render/InstancedGraphicPropsBuilder";
import { InstancedGraphicParams, InstancedGraphicProps } from "../../common/render/InstancedGraphicParams";
import { InstanceBuffers, InstanceBuffersData } from "../../render/webgl/InstancedGeometry";
import { IModelApp } from "../../IModelApp";
import { ColorDef, EmptyLocalization, Feature, LinePixels, ModelFeature, RenderMode } from "@itwin/core-common";
import { GraphicType } from "../../common";
import { Color, openBlankViewport, readColorCounts, readUniqueColors, readUniqueFeatures } from "../openBlankViewport";
import { GraphicBranch, readGltfTemplate, StandardViewId } from "../../core-frontend";
import { _featureTable } from "../../common/internal/Symbols";

describe("RenderInstancesParamsBuilder", () => {
  it("throws if no instances supplied", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    expect(() => builder.finish()).toThrow("No instances defined");
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
    expect(finish().features).toBeUndefined();

    reset();
    addInstance(Id64.invalid);
    expect(finish().features).toBeDefined();

    reset();
    addInstance("0x123");
    expect(finish().features).toBeDefined();

    reset();
    addInstance();
    addInstance("0x123");
    addInstance(Id64.invalid);
    expect(finish().features).toBeDefined();
  });
});

describe("InstanceBuffers", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

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
    expect(a.isDisposed).toBe(false);
    expect(b.isDisposed).toBe(false);
    expect(c.isDisposed).toBe(false);

    a.dispose();
    b.dispose();
    c.dispose();
    expect(a.isDisposed).toBe(true);
    expect(b.isDisposed).toBe(true);
    expect(c.isDisposed).toBe(false);
  });

  it("are disposable when creating from InstancedGraphicParams", () => {
    const params = InstancedGraphicParams.fromProps(makeInstances());
    const buffers = InstanceBuffers.fromParams(params, () => new Range3d())!;
    expect(buffers.isDisposed).toBe(false);

    buffers.dispose();
    expect(buffers.isDisposed).toBe(true);
  });

  it("are non-disposable when created from RenderInstances", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    builder.add({ transform: Transform.createIdentity() });
    const params = builder.finish();

    const instances = IModelApp.renderSystem.createRenderInstances(params)!;
    const buffers = InstanceBuffers.fromRenderInstances(instances, new Range3d());
    expect(buffers.isDisposed).toBe(false);

    buffers.dispose();
    expect(buffers.isDisposed).toBe(false);
  });
});

describe("RenderInstances", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("populates feature table", () => {
    const paramsBuilder = RenderInstancesParamsBuilder.create({ modelId: "0xf" });
    paramsBuilder.add({ feature: "0x1", transform: Transform.createIdentity() });
    paramsBuilder.add({ feature: "0x2", transform: Transform.createIdentity() });
    paramsBuilder.add({ feature: "0x3", transform: Transform.createIdentity() });
    paramsBuilder.add({ feature: "0x4", transform: Transform.createIdentity() });
    const params = paramsBuilder.finish();

    const instances = IModelApp.renderSystem.createRenderInstances(params)!;
    expect(instances).toBeDefined();

    const ft = instances[_featureTable]!;
    expect(ft).toBeDefined();
    expect(ft.numFeatures).toEqual(4);
    expect(ft.batchModelId).toEqual("0xf");

    const feat = ModelFeature.create();
    expect(ft.findFeature(0, feat)?.elementId).toEqual("0x1");
    expect(ft.findFeature(1, feat)?.elementId).toEqual("0x2");
    expect(ft.findFeature(2, feat)?.elementId).toEqual("0x3");
    expect(ft.findFeature(3, feat)?.elementId).toEqual("0x4");
  });

  it("renders multiple instances of glTF model with different features and color overrides", async () => {
    // a single white triangle from https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Triangle
    const gltfJson = `{
      "scene" : 0,
      "scenes" : [
        {
          "nodes" : [ 0 ]
        }
      ],

      "nodes" : [
        {
          "mesh" : 0
        }
      ],

      "meshes" : [
        {
          "primitives" : [ {
            "attributes" : {
              "POSITION" : 1
            },
            "indices" : 0
          } ]
        }
      ],

      "buffers" : [
        {
          "uri" : "data:application/octet-stream;base64,AAABAAIAAAAAAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAACAPwAAAAA=",
          "byteLength" : 44
        }
      ],
      "bufferViews" : [
        {
          "buffer" : 0,
          "byteOffset" : 0,
          "byteLength" : 6,
          "target" : 34963
        },
        {
          "buffer" : 0,
          "byteOffset" : 8,
          "byteLength" : 36,
          "target" : 34962
        }
      ],
      "accessors" : [
        {
          "bufferView" : 0,
          "byteOffset" : 0,
          "componentType" : 5123,
          "count" : 3,
          "type" : "SCALAR",
          "max" : [ 2 ],
          "min" : [ 0 ]
        },
        {
          "bufferView" : 1,
          "byteOffset" : 0,
          "componentType" : 5126,
          "count" : 3,
          "type" : "VEC3",
          "max" : [ 1.0, 1.0, 0.0 ],
          "min" : [ 0.0, 0.0, 0.0 ]
        }
      ],

      "asset" : {
        "version" : "2.0"
      }
    }`;

    const vp = openBlankViewport({ height: 100, width: 100 });
    vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, visibleEdges: false, lighting: false });
    vp.view.setStandardRotation(StandardViewId.Iso);
    const viewVolume = Range3d.create(vp.iModel.projectExtents.center);
    viewVolume.expandInPlace(5);
    vp.view.lookAtVolume(viewVolume, vp.viewRect.aspect);
    vp.synchWithView({ animateFrustumChange: false });
    vp.displayStyle.backgroundColor = ColorDef.black;

    const id = "0x1";
    const modelId = "0x2";
    const gltfTemplate = await readGltfTemplate({
      gltf: JSON.parse(gltfJson),
      iModel: vp.iModel,
      pickableOptions: { id, modelId },
    });

    const template = gltfTemplate!.template;
    expect(template).toBeDefined();

    const instancesBuilder = RenderInstancesParamsBuilder.create({ modelId });
    instancesBuilder.add({
      feature: "0x3",
      transform: Transform.createTranslationXYZ(-1, 0, 0),
    });
    instancesBuilder.add({
      feature: "0x4",
      transform: Transform.createTranslationXYZ(1, 0, 0),
    });
    instancesBuilder.add({
      feature: "0x5",
      transform: Transform.createTranslationXYZ(0, 1, 0),
    });
    instancesBuilder.add({
      feature: "0x6",
      transform: Transform.createTranslationXYZ(0, -1, 0),
      symbology: { color: {r: 0, g: 0, b: 255 } },
    });
    const instances = IModelApp.renderSystem.createRenderInstances(instancesBuilder.finish())!;
    expect(instances[_featureTable]!.numFeatures).toEqual(4);

    let graphic = IModelApp.renderSystem.createGraphicFromTemplate({ template, instances });
    const branch = new GraphicBranch();
    branch.add(graphic);
    graphic = IModelApp.renderSystem.createGraphicBranch(branch, Transform.createTranslation(vp.iModel.projectExtents.center));
    graphic = IModelApp.renderSystem.createGraphicOwner(graphic);

    IModelApp.viewManager.addDecorator({
      decorate: (context) => {
        context.addDecoration(GraphicType.Scene, graphic);
      },
    });

    vp.renderFrame();
    const colors = readUniqueColors(vp);
    expect(colors.length).toEqual(3);
    expect(colors.containsColorDef(vp.displayStyle.backgroundColor)).toBe(true);
    expect(colors.containsColorDef(ColorDef.white)).toBe(true);
    expect(colors.containsColorDef(ColorDef.blue)).toBe(true);

    const features = readUniqueFeatures(vp);
    expect(features.length).toEqual(4);
    expect(features.contains(new Feature("0x3"))).toBe(true);

    vp.dispose();
  });

  it("renders the same template with different symbologies", () => {
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

    // no overrides - red solid 1px
    paramsBuilder.add({
      transform: Transform.createTranslationXYZ(25, -25, 0),
    });

    // blue solid 1px
    paramsBuilder.add({
      transform: Transform.createTranslationXYZ(25, 25, 0),
      symbology: { color: { r: 0, g: 0, b: 255 } },
    });

    // green solid 3px
    paramsBuilder.add({
      transform: Transform.createTranslationXYZ(-25, 25, 0),
      symbology: { weight: 3, color: { r: 0, g: 128, b: 0 } },
    });

    // white dashed 1px
    paramsBuilder.add({
      transform: Transform.createTranslationXYZ(-25, -25, 0),
      symbology: { linePixels: LinePixels.HiddenLine, color: { r: 255, g: 255, b: 255 } },
    });

    // Create a graphic from the template+instances, translated to the center of the viewport.
    const instances = IModelApp.renderSystem.createRenderInstances(paramsBuilder.finish())!;
    expect(instances).toBeDefined();

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

    const colors = readColorCounts(vp);
    expect(colors.size).toEqual(5);
    const background = colors.get(Color.fromColorDef(ColorDef.black))!;
    const red = colors.get(Color.fromColorDef(ColorDef.red))!;
    const blue = colors.get(Color.fromColorDef(ColorDef.blue))!;
    const green= colors.get(Color.fromColorDef(ColorDef.green))!;
    const white = colors.get(Color.fromColorDef(ColorDef.white))!;

    // dashed - fewer pixels
    expect(white).lessThan(red);
    // solid, same width => same number of pixels
    expect(red).toEqual(blue);
    // wider => more pixels
    expect(green).greaterThan(red);
    // most of view is background
    expect(background).greaterThan(green);

    vp.dispose();
  });
});

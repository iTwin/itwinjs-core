/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Angle, Point2d, Point3d, Range3d, Transform, XYAndZ } from "@itwin/core-geometry";
import {
  ColorDef,
  EmptyLocalization,
  Feature,
  FillFlags,
  GeometryClass,
  Gradient,
  GraphicParams,
  ImageBuffer,
  ImageBufferFormat,
  ImageSource,
  ImageSourceFormat,
  LinePixels,
  ModelFeature,
  RenderFeatureTable,
  RenderMaterial,
  RenderTexture,
  TextureTransparency,
} from "@itwin/core-common";
import { createWorkerProxy } from "../../common/WorkerProxy";
import { TestWorker } from "../worker/test-worker";
import { IModelApp } from "../../IModelApp";
import { MeshGraphic } from "../../render/webgl/Mesh";
import { GraphicDescriptionBuilder, GraphicDescriptionBuilderOptions, imageBufferToPngDataUrl } from "../../common";
import { GraphicType } from "../../common/render/GraphicType";
import { GraphicDescriptionImpl, isGraphicDescription } from "../../common/internal/render/GraphicDescriptionBuilderImpl";
import { Batch, Branch, GraphicsArray } from "../../webgl";
import { ImdlModel } from "../../common/imdl/ImdlModel";
import { Id64, Id64String, TransientIdSequence } from "@itwin/core-bentley";
import { GraphicDescriptionContext, WorkerGraphicDescriptionContext } from "../../common/render/GraphicDescriptionContext";
import { WorkerTexture } from "../../common/internal/render/GraphicDescriptionContextImpl";
import { _textures } from "../../common/internal/Symbols";
import { Material } from "../../render/webgl/Material";
import { IModelConnection } from "../../IModelConnection";

function expectRange(range: Readonly<Range3d>, translation: XYAndZ | undefined, lx: number, ly: number, lz: number, hx: number, hy: number, hz: number): void {
  if (!translation) {
    translation = { x: 0, y: 0, z: 0 };
  }

  expect(range.low.x).toEqual(lx - translation.x);
  expect(range.low.y).toEqual(ly - translation.y);
  expect(range.low.z).toEqual(lz - translation.z);
  expect(range.high.x).toEqual(hx - translation.x);
  expect(range.high.y).toEqual(hy - translation.y);
  expect(range.high.z).toEqual(hz - translation.z);
}

function expectFeature(index: number, featureTable: RenderFeatureTable, expected: ModelFeature): void {
  const actual = ModelFeature.create();
  featureTable.getFeature(index, actual);
  expect(actual).toEqual(expected);
}

function createIModel(): IModelConnection {
  return { transientIds: new TransientIdSequence() } as unknown as IModelConnection;
}

describe("GraphicDescriptionBuilder", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    Material.preserveParams = true;
  });

  afterAll(async () => {
    Material.preserveParams = false;
    await IModelApp.shutdown();
  });

  async function createContexts(): Promise<{ iModel: IModelConnection, workerContext: WorkerGraphicDescriptionContext, mainContext: GraphicDescriptionContext }> {
    const iModel = createIModel();
    const contextProps = IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel);
    const workerContext = WorkerGraphicDescriptionContext.fromProps(contextProps);
    const mainContext = await IModelApp.renderSystem.resolveGraphicDescriptionContext(workerContext.toProps(new Set()), iModel);
    return { iModel, workerContext, mainContext };
  }

  const computeChordTolerance = () => 0;
  const graphicTypes = [GraphicType.ViewBackground, GraphicType.Scene, GraphicType.WorldDecoration, GraphicType.WorldOverlay, GraphicType.ViewOverlay];

  function expectOption(workerContext: WorkerGraphicDescriptionContext, options: Omit<GraphicDescriptionBuilderOptions, "context" | "computeChordTolerance">, option: "wantEdges" | "wantNormals" | "preserveOrder", expected: boolean): void {
    const builder = GraphicDescriptionBuilder.create({ ...options, context: workerContext, computeChordTolerance });
    expect(builder[option]).toEqual(expected);
  }

  it("preserves order for overlay and background graphics", async () => {
    const { workerContext } = await createContexts();
    for (const type of graphicTypes) {
      expectOption(workerContext, { type }, "preserveOrder", type === GraphicType.ViewOverlay || type === GraphicType.WorldOverlay || type === GraphicType.ViewBackground);
    }
  });

  it("wants edges for scene graphics or if explicitly requested", async () => {
    const { workerContext } = await createContexts();
    for (const type of graphicTypes) {
      expectOption(workerContext, { type, generateEdges: true }, "wantEdges", true);
      expectOption(workerContext, { type, generateEdges: false }, "wantEdges", false);
      expectOption(workerContext, { type }, "wantEdges", GraphicType.Scene === type);
    }
  });

  it("wants normals for scene graphics or if edges are requested", async () => {
    const { workerContext } = await createContexts();
    for (const type of graphicTypes) {
      expectOption(workerContext, { type, generateEdges: true }, "wantNormals", true);
      expectOption(workerContext, { type }, "wantNormals", GraphicType.Scene === type);
      expectOption(workerContext, { type, generateEdges: false }, "wantNormals", GraphicType.Scene === type);
    }
  });

  function finish(builder: GraphicDescriptionBuilder): GraphicDescriptionImpl {
    const descr = builder.finish();
    if (!isGraphicDescription(descr)) {
      throw new Error("not a graphic description");
    }

    return descr;
  }

  it("creates a graphic", async () => {
    const { workerContext, mainContext } = await createContexts();
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.ViewOverlay, context: workerContext, computeChordTolerance });
    expect(builder.wantEdges).toBe(false);
    builder.setSymbology(ColorDef.blue, ColorDef.blue, 2);
    builder.addShape2d([new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5)], 2);

    const descr = finish(builder);
    expect(descr.batch).toBeUndefined();
    expect(descr.type).toEqual(GraphicType.ViewOverlay);
    expect(descr.translation!.x).toEqual(5);
    expect(descr.translation!.y).toEqual(2.5);
    expect(descr.translation!.z).toEqual(2);
    expect(descr.translation).toBeDefined();
    expect(descr.primitives.length).toEqual(1);
    expect(descr.primitives[0].type).toEqual("mesh");

    const meshParams = descr.primitives[0].params as ImdlModel.MeshParams;
    expect(meshParams.vertices.uniformColor).toEqual(ColorDef.blue.toJSON());
    expect(meshParams.isPlanar).toBe(true);
    expect(meshParams.edges).toBeUndefined();

    const branch = IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).toBe(true);
    expect(branch.branch.entries.length).toEqual(1);

    const mesh = branch.branch.entries[0] as MeshGraphic;
    expect(mesh instanceof MeshGraphic).toBe(true);
    expect(mesh.primitives.length).toEqual(1);
    expectRange(mesh.meshRange, undefined, -5, -2.5, 0, 5, 2.5, 0);

    const gfPrim = mesh.primitives[0].toPrimitive();
    const geom = gfPrim.cachedGeometry.asMesh!;
    expect(geom.lut.colorInfo.isUniform).toBe(true);
    expect(geom.lut.colorInfo.uniform.red).toEqual(0);
    expect(geom.lut.colorInfo.uniform.blue).toEqual(1);
    expect(geom.lut.colorInfo.uniform.green).toEqual(0);
    expect(geom.lut.colorInfo.uniform.alpha).toEqual(1);
  });

  it("creates a graphic with edges", async () => {
    const { workerContext, mainContext } = await createContexts();
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.Scene, context: workerContext, computeChordTolerance });
    expect(builder.wantEdges).toBe(true);
    builder.setSymbology(ColorDef.blue, ColorDef.blue, 3, LinePixels.HiddenLine);
    builder.addShape2d([new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5)], 2);

    const descr = finish(builder);
    expect(descr.batch).toBeUndefined();
    expect(descr.type).toEqual(GraphicType.Scene);
    expect(descr.translation!.x).toEqual(5);
    expect(descr.translation!.y).toEqual(2.5);
    expect(descr.translation!.z).toEqual(2);
    expect(descr.translation).toBeDefined();
    expect(descr.primitives.length).toEqual(1);
    expect(descr.primitives[0].type).toEqual("mesh");

    const meshParams = descr.primitives[0].params as ImdlModel.MeshParams;
    const edgeParams = meshParams.edges!;
    expect(edgeParams).toBeDefined();
    expect(edgeParams.linePixels).toEqual(LinePixels.HiddenLine);
    expect(edgeParams.weight).toEqual(3);
    expect(edgeParams.polylines).toBeUndefined();
    expect(edgeParams.segments).toBeUndefined();
    expect(edgeParams.silhouettes).toBeUndefined();
    expect(edgeParams.indexed).toBeDefined();

    const branch = IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).toBe(true);
    expect(branch.branch.entries.length).toEqual(1);

    const mesh = branch.branch.entries[0] as MeshGraphic;
    expect(mesh instanceof MeshGraphic).toBe(true);
    expect(mesh.primitives.length).toEqual(2);
    expectRange(mesh.meshRange, undefined, -5, -2.5, 0, 5, 2.5, 0);

    const gfPrim = mesh.primitives[0].toPrimitive();
    const geom = gfPrim.cachedGeometry.asMesh!;
    expect(geom.lut.colorInfo.isUniform).toBe(true);
    expect(geom.lut.colorInfo.uniform.red).toEqual(0);
    expect(geom.lut.colorInfo.uniform.blue).toEqual(1);
    expect(geom.lut.colorInfo.uniform.green).toEqual(0);
    expect(geom.lut.colorInfo.uniform.alpha).toEqual(1);

    const edges = mesh.primitives[1].toPrimitive().cachedGeometry.asMesh!;
    expect(edges.asIndexedEdge).toBeDefined();
    expect(edges.asIndexedEdge!.lut.colorInfo.isUniform).toBe(true);
    expect(edges.asIndexedEdge!.lut.colorInfo.uniform.red).toEqual(0);
    expect(edges.asIndexedEdge!.lut.colorInfo.uniform.blue).toEqual(1);
    expect(edges.asIndexedEdge!.lut.colorInfo.uniform.green).toEqual(0);
    expect(edges.asIndexedEdge!.lut.colorInfo.uniform.alpha).toEqual(1);
  });

  it("applies a placement transform to the graphics", async () => {
    const { workerContext, mainContext } = await createContexts();
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldDecoration,
      context: workerContext,
      computeChordTolerance,
      placement: Transform.createTranslationXYZ(6, 7, 8),
    });

    builder.setSymbology(ColorDef.blue, ColorDef.blue, 3, LinePixels.HiddenLine);
    builder.addShape2d([new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5)], 2);

    const descr = finish(builder);
    expect(descr.translation!.x).toEqual(5 + 6);
    expect(descr.translation!.y).toEqual(2.5 + 7);
    expect(descr.translation!.z).toEqual(2 + 8);

    const branch = IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    const mesh = branch.branch.entries[0] as MeshGraphic;
    expect(mesh.primitives.length).toEqual(1);
    expectRange(mesh.meshRange, undefined, -5, -2.5, 0, 5, 2.5, 0);
  });

  it("creates a view-independent graphic", async () => {
    const { workerContext, mainContext } = await createContexts();
    const viewIndependentOrigin = new Point3d(6, 7, 8);
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldDecoration,
      context: workerContext,
      computeChordTolerance,
      viewIndependentOrigin,
    });

    builder.setSymbology(ColorDef.blue, ColorDef.blue, 3, LinePixels.HiddenLine);
    builder.addShape2d([new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5)], 2);

    const descr = finish(builder);

    const mod = descr.primitives[0].modifier as ImdlModel.ViewIndependentOrigin;
    expect(mod.type).toEqual("viewIndependentOrigin");
    const origin = Point3d.fromJSON(mod.origin);
    expect(origin.isExactEqual(viewIndependentOrigin)).toBe(true);

    const branch = IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    const mesh = branch.branch.entries[0] as MeshGraphic;
    const geom = mesh.primitives[0].cachedGeometry;
    expect(geom.viewIndependentOrigin!.isExactEqual(viewIndependentOrigin)).toBe(true);
  });

  it("creates a batch containing a single feature with only an Id", async () => {
    const { workerContext, mainContext } = await createContexts();
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldOverlay,
      context: workerContext,
      computeChordTolerance,
      pickable: {
        id: "0x123",
        noFlash: true,
        locateOnly: true,
        noHilite: false,
      },
    });

    builder.addShape2d([new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5)], 2);

    const descr = finish(builder);
    const batchDescr = descr.batch!;
    expect(batchDescr).toBeDefined();
    expect(batchDescr.featureTable.numFeatures).toEqual(1);
    expect(batchDescr.featureTable.multiModel).toBe(false);
    expect(batchDescr.featureTable.numSubCategories).toBeUndefined();
    expect(batchDescr.noFlash).toBe(true);
    expect(batchDescr.locateOnly).toBe(true);
    expect(batchDescr.noHilite).toBe(false);
    expect(batchDescr.noEmphasis).toBeUndefined();
    expect(batchDescr.modelId).toEqual("0x123");
    expect(batchDescr.isVolumeClassifier).toBeUndefined();
    expectRange(Range3d.fromJSON(batchDescr.range), descr.translation, 0, 0, 2, 10, 5, 2);

    const branch = IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).toBe(true);
    expect(branch.branch.entries.length).toEqual(1);

    const batch = branch.branch.entries[0] as Batch;
    expect(batch instanceof Batch).toBe(true);

    expect(batch.options.noFlash).toBe(true);
    expect(batch.options.locateOnly).toBe(true);
    expect(batch.options.noHilite).toBe(false);
    expect(batch.options.noEmphasis).toBeUndefined();
    expect(batch.locateOnly).toBe(true);

    expect(batch.featureTable.batchModelId).toEqual("0x123");
    expect(batch.featureTable.numFeatures).toEqual(1);
    expectFeature(0, batch.featureTable, { elementId: "0x123", geometryClass: GeometryClass.Primary, subCategoryId: "0", modelId: "0x123" });

    expectRange(batch.range, descr.translation, 0, 0, 2, 10, 5, 2);

    const mesh = batch.graphic as MeshGraphic;
    expect(mesh instanceof MeshGraphic).toBe(true);
    expect(mesh.primitives.length).toEqual(1);
  });

  it("creates a batch containing a single full feature with a model Id", async () => {
    const { workerContext, mainContext } = await createContexts();
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldOverlay,
      context: workerContext,
      computeChordTolerance,
      pickable: {
        id: "0x123",
        geometryClass: GeometryClass.Construction,
        modelId: "0x456",
        subCategoryId: "0x789",
      },
    });

    builder.addShape2d([new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5)], 2);

    const descr = finish(builder);
    const batchDescr = descr.batch!;
    expect(batchDescr).toBeDefined();
    expect(batchDescr.featureTable.numFeatures).toEqual(1);
    expect(batchDescr.featureTable.multiModel).toBe(false);
    expect(batchDescr.featureTable.numSubCategories).toBeUndefined();
    expect(batchDescr.modelId).toEqual("0x456");
    expectRange(Range3d.fromJSON(batchDescr.range), descr.translation, 0, 0, 2, 10, 5, 2);

    const branch = IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).toBe(true);
    expect(branch.branch.entries.length).toEqual(1);

    const batch = branch.branch.entries[0] as Batch;
    expect(batch instanceof Batch).toBe(true);

    expect(batch.featureTable.batchModelId).toEqual("0x456");
    expect(batch.featureTable.numFeatures).toEqual(1);
    expectFeature(0, batch.featureTable, { elementId: "0x123", modelId: "0x456", subCategoryId: "0x789", geometryClass: GeometryClass.Construction });

    expectRange(batch.range, descr.translation, 0, 0, 2, 10, 5, 2);

    const mesh = batch.graphic as MeshGraphic;
    expect(mesh instanceof MeshGraphic).toBe(true);
    expect(mesh.primitives.length).toEqual(1);
  });

  it("creates a batch containing multiple features", async () => {
    const { workerContext, mainContext } = await createContexts();
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldOverlay,
      context: workerContext,
      computeChordTolerance,
      pickable: {
        id: "0xa1",
        geometryClass: GeometryClass.Construction,
        modelId: "0xb1",
        subCategoryId: "0xc1",
      },
    });

    builder.addPointString([new Point3d(1, 1, 1)]);

    builder.activatePickableId("0xa2");
    builder.addPointString([new Point3d(2, 2, 2)]);

    builder.activateFeature(new Feature("0xa3", "0xc2", GeometryClass.Primary));
    builder.addPointString([new Point3d(3, 3, 3)]);

    const descr = finish(builder);
    const batchDescr = descr.batch!;
    expect(batchDescr).toBeDefined();
    expect(batchDescr.featureTable.numFeatures).toEqual(3);
    expect(batchDescr.featureTable.multiModel).toBe(false);
    expect(batchDescr.featureTable.numSubCategories).toBeUndefined();
    expect(batchDescr.modelId).toEqual("0xb1");
    expectRange(Range3d.fromJSON(batchDescr.range), descr.translation, 1, 1, 1, 3, 3, 3);

    const branch = IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).toBe(true);
    expect(branch.branch.entries.length).toEqual(1);

    const batch = branch.branch.entries[0] as Batch;
    expect(batch instanceof Batch).toBe(true);

    expect(batch.featureTable.batchModelId).toEqual("0xb1");
    expect(batch.featureTable.numFeatures).toEqual(3);

    expectRange(batch.range, descr.translation, 1, 1, 1, 3, 3, 3);

    expectFeature(0, batch.featureTable, { elementId: "0xa1", subCategoryId: "0xc1", geometryClass: GeometryClass.Construction, modelId: "0xb1" });
    expectFeature(1, batch.featureTable, { elementId: "0xa2", subCategoryId: "0xc1", geometryClass: GeometryClass.Construction, modelId: "0xb1" });
    expectFeature(2, batch.featureTable, { elementId: "0xa3", subCategoryId: "0xc2", geometryClass: GeometryClass.Primary, modelId: "0xb1" });
  });

  // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
  // bottom right pixel.  The rest of the square is red.
  const pngData: Uint8Array = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9,
    112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78,
    68, 174, 66, 96, 130,
  ]);

  const gradient = Gradient.Symb.fromJSON({
    mode: 3,
    flags: 1,
    tint: 0.042133128966509004,
    shift: 3.45912515864202,
    angle: Angle.createDegrees(92.94598821201656),
    keys: [
      { value: 0.6804815398789292, color: 610 },
      { value: 0.731472008309797, color: 230 },
    ],
  });

  it("creates and resolves textures", async () => {
    const { workerContext } = await createContexts();
    function expectWorkerTexture(texture: WorkerTexture, type: RenderTexture.Type, source: ImageSource | ImageBuffer | URL | Gradient.Symb, transparency: TextureTransparency | undefined): void {
      expect(texture.type).toEqual(type);
      expect(texture.source.transparency).toEqual(transparency);
      if (source instanceof ImageSource) {
        expect(texture.source.imageSource).toEqual(source.data);
        expect(texture.source.format).toEqual(source.format);
      } else if (source instanceof ImageBuffer) {
        expect(texture.source.imageBuffer).toEqual(source.data);
        expect(texture.source.format).toEqual(source.format);
        expect(texture.source.width).toEqual(source.width);
      } else if (source instanceof URL) {
        expect(texture.source.url).toEqual(source.toString());
      } else {
        expect(source instanceof Gradient.Symb).toBe(true);
        expect(texture.source.gradient).toEqual(source);
      }
    }

    const wkGrad = workerContext.createGradientTexture(gradient) as WorkerTexture;
    expectWorkerTexture(wkGrad, RenderTexture.Type.Normal, gradient, undefined);

    const imgBuf = ImageBuffer.create(new Uint8Array([255, 0, 0, 0, 255, 0, 0, 63, 255, 0, 0, 127, 255, 0, 0, 191]), ImageBufferFormat.Rgba, 2);

    const wkBuf = workerContext.createTexture({
      type: RenderTexture.Type.TileSection,
      transparency: TextureTransparency.Translucent,
      source: imgBuf,
    }) as WorkerTexture;
    expectWorkerTexture(wkBuf, RenderTexture.Type.TileSection, imgBuf, TextureTransparency.Translucent);

    const imgSrc = new ImageSource(pngData, ImageSourceFormat.Png);
    const wkSrc = workerContext.createTexture({
      type: RenderTexture.Type.SkyBox,
      transparency: TextureTransparency.Opaque,
      source: imgSrc,
    }) as WorkerTexture;
    expectWorkerTexture(wkSrc, RenderTexture.Type.SkyBox, imgSrc, TextureTransparency.Opaque);

    const pngUrl = imageBufferToPngDataUrl(imgBuf, true)!;
    expect(pngUrl).toBeDefined();
    const url = new URL(pngUrl);
    const wkUrl = workerContext.createTexture({
      source: url,
    }) as WorkerTexture;
    expectWorkerTexture(wkUrl, RenderTexture.Type.Normal, url, undefined);

    const xfers = new Set<Transferable>();
    const contextProps = workerContext.toProps(xfers);
    expect(xfers.size).toEqual(2);
    expect(Array.from(xfers).every((x) => x instanceof ArrayBuffer)).toBe(true);

    const iModel = createIModel();
    const context = await IModelApp.renderSystem.resolveGraphicDescriptionContext(contextProps, iModel);
    expect(context[_textures].size).toEqual(4);
  });

  // eslint-disable-next-line deprecation/deprecation
  function expectMaterial(mat: Material, expected: Partial<RenderMaterial.Params>): void {
    expect(mat.params).toBeDefined();
    const actual = {
      ...mat.params,
      textureMapping: undefined,
      alpha: mat.params!.alpha,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _alpha: undefined, // stupid class instead of interface
    };
    delete actual._alpha;

    expected = {
      // eslint-disable-next-line deprecation/deprecation
      ...RenderMaterial.Params.defaults,
      diffuseColor: undefined,
      alpha: undefined,
      ...expected,
      textureMapping: undefined,
    };

    expect(actual).toEqual(expected);
  }

  it("creates a graphic containing materials and textures", async () => {
    const { workerContext } = await createContexts();
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.WorldDecoration, context: workerContext, computeChordTolerance });
    const addShape = () => {
      builder.addShape2d([new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5)], 2);
    };

    const addShapeWithMaterial = (material: RenderMaterial) => {
      const params = new GraphicParams();
      params.material = material;
      builder.activateGraphicParams(params);
      addShape();
    };

    // 0: blue material, no texture
    const blueMaterial = workerContext.createMaterial({
      diffuse: {
        color: ColorDef.blue,
        weight: 0.5,
      },
    });
    addShapeWithMaterial(blueMaterial);

    // 1: material with gradient texture and specular.
    const gradTx = workerContext.createGradientTexture(gradient);
    const gradMaterial = workerContext.createMaterial({
      textureMapping: { texture: gradTx },
      specular: {
        color: ColorDef.red,
        weight: 0.25,
        exponent: 10,
      },
    });
    addShapeWithMaterial(gradMaterial);

    // 2: material with texture from PNG and alpha.
    const pngTx = workerContext.createTexture({ source: new ImageSource(pngData, ImageSourceFormat.Png) });
    const pngMaterial = workerContext.createMaterial({
      textureMapping: { texture: pngTx },
      alpha: 0.75,
    });
    addShapeWithMaterial(pngMaterial);

    // 3: material with texture from ImageBuffer.
    const imgBuf = ImageBuffer.create(new Uint8Array([255, 0, 0, 0, 255, 0, 0, 63, 255, 0, 0, 127, 255, 0, 0, 191]), ImageBufferFormat.Rgba, 2);
    const imgTx = workerContext.createTexture({ source: imgBuf });
    const imgMaterial = workerContext.createMaterial({ textureMapping: { texture: imgTx } });
    addShapeWithMaterial(imgMaterial);

    // 4: material with texture from URL.
    const urlTx = workerContext.createTexture({ source: new URL(imageBufferToPngDataUrl(imgBuf, true)!) });
    const urlMaterial = workerContext.createMaterial({ textureMapping: { texture: urlTx } });
    addShapeWithMaterial(urlMaterial);

    // 5: no material - just a gradient texture.
    const gfParams = new GraphicParams();
    gfParams.gradient = gradient;
    gfParams.fillFlags = FillFlags.Always; // prevent it from producing an outline for the gradient (polyline geometry).
    builder.activateGraphicParams(gfParams);
    addShape();

    const description = builder.finish() as GraphicDescriptionImpl;
    expect(description.primitives.length).toEqual(6);

    // NOTE: The ordering of the primitives is based on the ordering of their DisplayParams, which can change from run to run because
    // materials and textures are assigned GUIDs for ordered comparisons.
    // Figure out what order they ended up in so we can test their properties.
    const meshIndices = description.primitives.map((primitive) => {
      expect(primitive.type).toEqual("mesh");
      const params = (primitive.params as ImdlModel.MeshParams).surface;
      if (params.textureMapping === undefined) {
        // The first mesh we created has only a material - no texture.
        return 0;
      } else if (params.material === undefined) {
        // We use the same gradient twice above, so we end up reusing the texture created from it for two meshes.
        // The last mesh uses the gradient directly, so has no material.
        expect(params.textureMapping.texture).toEqual("0");
        return 5;
      } else {
        expect(typeof params.textureMapping.texture).toEqual("string");
        const txIndex = Number.parseInt(params.textureMapping.texture as string, 10);
        expect(Number.isNaN(txIndex)).toBe(false);
        expect(txIndex).least(0);
        expect(txIndex).most(4);
        return txIndex + 1;
      }
    });

    const context = await IModelApp.renderSystem.resolveGraphicDescriptionContext(workerContext.toProps(new Set()), createIModel());
    const branch = IModelApp.renderSystem.createGraphicFromDescription({ description, context }) as Branch;
    expect(branch).toBeDefined();
    expect(branch instanceof Branch).toBe(true);
    expect(branch.branch.entries.length).toEqual(1);

    const array = branch.branch.entries[0] as GraphicsArray;
    expect(array instanceof GraphicsArray).toBe(true);
    expect(array.graphics.length).toEqual(6);

    const meshes = array.graphics as MeshGraphic[];
    expect(meshes.every((x) => x instanceof MeshGraphic));

    for (let i = 0; i < meshes.length; i++) {
      const index = meshIndices.indexOf(i);
      expect(index).least(0);
      const mesh = meshes[index];
      expect(mesh.meshData.texture === undefined).toEqual(i === 0);

      if (i === 5) {
        expect(mesh.meshData.materialInfo).toBeUndefined();
        continue;
      }

      expect(mesh.meshData.materialInfo?.isAtlas).toBe(false);
      const mat = mesh.meshData.materialInfo as Material;
      expect(mat instanceof Material).toBe(true);

      switch (i) {
        case 0:
          expectMaterial(mat, {
            diffuseColor: ColorDef.blue,
            diffuse: 0.5,
          });
          break;
        case 1:
          expectMaterial(mat, {
            specularColor: ColorDef.red,
            specular: 0.25,
            specularExponent: 10,
          });
          break;
        case 2:
          expectMaterial(mat, { alpha: 0.75 });
          break;
        case 3:
        case 4:
          expectMaterial(mat, {});
          break;
      }
    }
  });

  describe("Worker", () => {
    const createWorker = () => createWorkerProxy<TestWorker>("/test-worker.js");

    it("throws on invalid context", async () => {
      const worker = createWorker();
      await expect(worker.createGraphic({} as any)).rejects.toThrow("Invalid WorkerGraphicDescriptionContextProps");
      worker.terminate();
      expect(worker.isTerminated).toBe(true);
    });

    function expectTransientId(id: string, expectedLocalId: number): void {
      expect(Id64.isTransient(id)).toBe(true);
      expect(Id64.getLocalId(id)).toEqual(expectedLocalId);
    }

    function makeTransientId(localId: number): Id64String {
      return Id64.fromLocalAndBriefcaseIds(localId, 0xffffff);
    }

    it("creates a graphic description", async () => {
      const worker = createWorker();

      const iModel = createIModel();
      const wkCtxt = IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel);
      const result = await worker.createGraphic(wkCtxt);
      expect(result.description).toBeDefined();
      expect(result.context).toBeDefined();

      worker.terminate();

      const d = result.description as GraphicDescriptionImpl;

      expect(d.translation!.x).toEqual(5);
      expect(d.translation!.y).toEqual(10);
      expect(d.translation!.z).toEqual(-1);

      expect(d.batch).toBeDefined();
      expect(d.batch!.featureTable.numFeatures).toEqual(3);
      expectTransientId(d.batch!.modelId, 2);
      expectRange(Range3d.fromJSON(d.batch!.range), d.translation, 0, 0, -4, 10, 20, 2);

      expect(d.primitives.length).toEqual(3);
      expect(d.primitives[0].type).toEqual("mesh");
      expect(d.primitives[1].type).toEqual("polyline");
      expect(d.primitives[2].type).toEqual("point");
      for (const primitive of d.primitives) {
        expect(primitive.modifier!.type).toEqual("viewIndependentOrigin");
        const origin = (primitive.modifier as ImdlModel.ViewIndependentOrigin).origin;
        expect(origin.x).toEqual(0);
        expect(origin.y).toEqual(1);
        expect(origin.z).toEqual(2);
      }
    });

    it("remaps transient Ids and creates a RenderGraphic", async () => {
      const iModel = createIModel();
      const transientIds = iModel.transientIds;
      expectTransientId(transientIds.getNext(), 1);

      const worker = createWorker();
      const result = await worker.createGraphic(IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel));
      worker.terminate();

      expectTransientId(transientIds.getNext(), 2);
      expectTransientId(transientIds.getNext(), 3);

      const resolvedContext = await IModelApp.renderSystem.resolveGraphicDescriptionContext(result.context, iModel);
      const graphic = IModelApp.renderSystem.createGraphicFromDescription({ context: resolvedContext, description: result.description });
      expect(graphic).toBeDefined();

      const branch = graphic as Branch;
      expect(branch.branch.entries.length).toEqual(1);
      const batch = branch.branch.entries[0] as Batch;
      expect(batch instanceof Batch).toBe(true);

      // TestWorker.createWorker assigns the following Ids, starting with transient local Id 2 because we allocated 1 above.
      //   modelId: 0xffffff0000000003
      //   point string: elem 0xffffff00000000002, subcat 0xffffff0000000004, class Construction
      //   shape: elem 0xffffff0000000005 subcat: 0x123 class: Primary
      //   polyline: elem 0x456 subcat: 0xffffff0000000006 class: Primary
      // The  transient Ids should be remapped so that their local Ids are increased by 2, because we allocated 2 more transient Ids before resolving the context.
      const ft = batch.featureTable;
      expect(ft.numFeatures).toEqual(3);
      const modelId = ft.batchModelId;
      expectTransientId(modelId, 5);
      expectFeature(0, ft, { elementId: makeTransientId(4), subCategoryId: makeTransientId(6), geometryClass: GeometryClass.Construction, modelId });
      expectFeature(1, ft, { elementId: makeTransientId(7), subCategoryId: "0x123", geometryClass: GeometryClass.Primary, modelId });
      expectFeature(2, ft, { elementId: "0x456", subCategoryId: makeTransientId(8), geometryClass: GeometryClass.Primary, modelId });

      const list = batch.graphic as GraphicsArray;
      expect(list instanceof GraphicsArray).toBe(true);
      expect(list.graphics.length).toEqual(3);
      expect(list.graphics[0] instanceof MeshGraphic).toBe(true);
    });
  });
});

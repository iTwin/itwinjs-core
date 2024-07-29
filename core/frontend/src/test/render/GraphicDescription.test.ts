/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Angle, Point2d, Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { ColorDef, EmptyLocalization, Feature, FillFlags, GeometryClass, Gradient, GraphicParams, ImageBuffer, ImageBufferFormat, ImageSource, ImageSourceFormat, LinePixels, ModelFeature, RenderFeatureTable, RenderMaterial, RenderTexture, TextureTransparency } from "@itwin/core-common";
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

function expectRange(range: Readonly<Range3d>, lx: number, ly: number, lz: number, hx: number, hy: number, hz: number): void {
  expect(range.low.x).to.equal(lx);
  expect(range.low.y).to.equal(ly);
  expect(range.low.z).to.equal(lz);
  expect(range.high.x).to.equal(hx);
  expect(range.high.y).to.equal(hy);
  expect(range.high.z).to.equal(hz);
}

function expectFeature(index: number, featureTable: RenderFeatureTable, expected: ModelFeature): void {
  const actual = ModelFeature.create();
  featureTable.getFeature(index, actual);
  expect(actual).to.deep.equal(expected);
}

function createIModel(): IModelConnection {
  return { transientIds: new TransientIdSequence() } as unknown as IModelConnection;
}

describe("GraphicDescriptionBuilder", () => {
  let mainContext: GraphicDescriptionContext;
  let workerContext: WorkerGraphicDescriptionContext;

  before(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    Material.preserveParams = true;

    // The context stuff is not really relevant to these tests because we're not passing data to worker threads and
    // we're not allocating transient Ids.
    const iModel = createIModel();
    const contextProps  = IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel);
    workerContext = WorkerGraphicDescriptionContext.fromProps(contextProps);
    mainContext = await IModelApp.renderSystem.resolveGraphicDescriptionContext(workerContext.toProps(new Set()), iModel);
  });

  after(async () => {
    Material.preserveParams = false;
    await IModelApp.shutdown();
  });

  const computeChordTolerance = () => 0;
  const graphicTypes = [GraphicType.ViewBackground, GraphicType.Scene, GraphicType.WorldDecoration, GraphicType.WorldOverlay, GraphicType.ViewOverlay];

  function expectOption(options: Omit<GraphicDescriptionBuilderOptions, "context" | "computeChordTolerance">, option: "wantEdges" | "wantNormals" | "preserveOrder", expected: boolean): void {
    const builder = GraphicDescriptionBuilder.create({ ...options, context: workerContext, computeChordTolerance });
    expect(builder[option]).to.equal(expected);
  }

  it("preserves order for overlay and background graphics", () => {
    for (const type of graphicTypes) {
      expectOption({ type }, "preserveOrder", type === GraphicType.ViewOverlay || type === GraphicType.WorldOverlay || type === GraphicType.ViewBackground);
    }
  });

  it("wants edges for scene graphics or if explicitly requested", () => {
    for (const type of graphicTypes) {
      expectOption({ type, generateEdges: true }, "wantEdges", true);
      expectOption({ type, generateEdges: false }, "wantEdges", false);
      expectOption({ type }, "wantEdges", GraphicType.Scene === type);
    }
  });

  it("wants normals for scene graphics or if edges are requested", () => {
    for (const type of graphicTypes) {
      expectOption({ type, generateEdges: true }, "wantNormals", true);
      expectOption({ type }, "wantNormals", GraphicType.Scene === type);
      expectOption({ type, generateEdges: false }, "wantNormals", GraphicType.Scene === type);
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
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.ViewOverlay, context: workerContext, computeChordTolerance });
    expect(builder.wantEdges).to.be.false;
    builder.setSymbology(ColorDef.blue, ColorDef.blue, 2);
    builder.addShape2d([
      new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
    ], 2);

    const descr = finish(builder);
    expect(descr.batch).to.be.undefined;
    expect(descr.type).to.equal(GraphicType.ViewOverlay);
    expect(descr.translation!.x).to.equal(5);
    expect(descr.translation!.y).to.equal(2.5);
    expect(descr.translation!.z).to.equal(2);
    expect(descr.translation).not.to.be.undefined;
    expect(descr.primitives.length).to.equal(1);
    expect(descr.primitives[0].type).to.equal("mesh");

    const meshParams = descr.primitives[0].params as ImdlModel.MeshParams;
    expect(meshParams.vertices.uniformColor).to.equal(ColorDef.blue.toJSON());
    expect(meshParams.isPlanar).to.be.true;
    expect(meshParams.edges).to.be.undefined;

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).to.be.true;
    expect(branch.branch.entries.length).to.equal(1);

    const mesh = branch.branch.entries[0] as MeshGraphic;
    expect(mesh instanceof MeshGraphic).to.be.true;
    expect(mesh.primitives.length).to.equal(1);
    expectRange(mesh.meshRange, -5, -2.5, 0, 5, 2.5, 0);

    const gfPrim = mesh.primitives[0].toPrimitive();
    const geom = gfPrim.cachedGeometry.asMesh!;
    expect(geom.lut.colorInfo.isUniform).to.be.true;
    expect(geom.lut.colorInfo.uniform.red).to.equal(0);
    expect(geom.lut.colorInfo.uniform.blue).to.equal(1);
    expect(geom.lut.colorInfo.uniform.green).to.equal(0);
    expect(geom.lut.colorInfo.uniform.alpha).to.equal(1);
  });

  it("creates a graphic with edges", async () => {
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.Scene, context: workerContext, computeChordTolerance });
    expect(builder.wantEdges).to.be.true;
    builder.setSymbology(ColorDef.blue, ColorDef.blue, 3, LinePixels.HiddenLine);
    builder.addShape2d([
      new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
    ], 2);

    const descr = finish(builder);
    expect(descr.batch).to.be.undefined;
    expect(descr.type).to.equal(GraphicType.Scene);
    expect(descr.translation!.x).to.equal(5);
    expect(descr.translation!.y).to.equal(2.5);
    expect(descr.translation!.z).to.equal(2);
    expect(descr.translation).not.to.be.undefined;
    expect(descr.primitives.length).to.equal(1);
    expect(descr.primitives[0].type).to.equal("mesh");

    const meshParams = descr.primitives[0].params as ImdlModel.MeshParams;
    const edgeParams = meshParams.edges!;
    expect(edgeParams).not.to.be.undefined;
    expect(edgeParams.linePixels).to.equal(LinePixels.HiddenLine);
    expect(edgeParams.weight).to.equal(3);
    expect(edgeParams.polylines).to.be.undefined;
    expect(edgeParams.segments).to.be.undefined;
    expect(edgeParams.silhouettes).to.be.undefined;
    expect(edgeParams.indexed).not.to.be.undefined;

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).to.be.true;
    expect(branch.branch.entries.length).to.equal(1);

    const mesh = branch.branch.entries[0] as MeshGraphic;
    expect(mesh instanceof MeshGraphic).to.be.true;
    expect(mesh.primitives.length).to.equal(2);
    expectRange(mesh.meshRange, -5, -2.5, 0, 5, 2.5, 0);

    const gfPrim = mesh.primitives[0].toPrimitive();
    const geom = gfPrim.cachedGeometry.asMesh!;
    expect(geom.lut.colorInfo.isUniform).to.be.true;
    expect(geom.lut.colorInfo.uniform.red).to.equal(0);
    expect(geom.lut.colorInfo.uniform.blue).to.equal(1);
    expect(geom.lut.colorInfo.uniform.green).to.equal(0);
    expect(geom.lut.colorInfo.uniform.alpha).to.equal(1);

    const edges = mesh.primitives[1].toPrimitive().cachedGeometry.asMesh!;
    expect(edges.asIndexedEdge).not.to.be.undefined;
    expect(edges.asIndexedEdge!.lut.colorInfo.isUniform).to.be.true;
    expect(edges.asIndexedEdge!.lut.colorInfo.uniform.red).to.equal(0);
    expect(edges.asIndexedEdge!.lut.colorInfo.uniform.blue).to.equal(1);
    expect(edges.asIndexedEdge!.lut.colorInfo.uniform.green).to.equal(0);
    expect(edges.asIndexedEdge!.lut.colorInfo.uniform.alpha).to.equal(1);
  });

  it("applies a placement transform to the graphics", async () => {
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldDecoration,
      context: workerContext,
      computeChordTolerance,
      placement: Transform.createTranslationXYZ(6, 7, 8),
    });

    builder.setSymbology(ColorDef.blue, ColorDef.blue, 3, LinePixels.HiddenLine);
    builder.addShape2d([
      new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
    ], 2);

    const descr = finish(builder);
    expect(descr.translation!.x).to.equal(5 + 6);
    expect(descr.translation!.y).to.equal(2.5 + 7);
    expect(descr.translation!.z).to.equal(2 + 8);

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    const mesh = branch.branch.entries[0] as MeshGraphic;
    expect(mesh.primitives.length).to.equal(1);
    expectRange(mesh.meshRange, -5, -2.5, 0, 5, 2.5, 0);
  });

  it("creates a view-independent graphic", async () => {
    const viewIndependentOrigin = new Point3d(6, 7, 8);
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldDecoration,
      context: workerContext,
      computeChordTolerance,
      viewIndependentOrigin,
    });

    builder.setSymbology(ColorDef.blue, ColorDef.blue, 3, LinePixels.HiddenLine);
    builder.addShape2d([
      new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
    ], 2);

    const descr = finish(builder);

    const mod = descr.primitives[0].modifier as ImdlModel.ViewIndependentOrigin;
    expect(mod.type).to.equal("viewIndependentOrigin");
    const origin = Point3d.fromJSON(mod.origin);
    expect(origin.isExactEqual(viewIndependentOrigin)).to.be.true;

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    const mesh = branch.branch.entries[0] as MeshGraphic;
    const geom = mesh.primitives[0].cachedGeometry;
    expect(geom.viewIndependentOrigin!.isExactEqual(viewIndependentOrigin)).to.be.true;
  });

  it("creates a batch containing a single feature with only an Id", async () => {
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

    builder.addShape2d([
      new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
    ], 2);

    const descr = finish(builder);
    const batchDescr = descr.batch!;
    expect(batchDescr).not.to.be.undefined;
    expect(batchDescr.featureTable.numFeatures).to.equal(1);
    expect(batchDescr.featureTable.multiModel).to.be.false;
    expect(batchDescr.featureTable.numSubCategories).to.be.undefined;
    expect(batchDescr.noFlash).to.be.true;
    expect(batchDescr.locateOnly).to.be.true;
    expect(batchDescr.noHilite).to.be.false;
    expect(batchDescr.noEmphasis).to.be.undefined;
    expect(batchDescr.modelId).to.equal("0x123");
    expect(batchDescr.isVolumeClassifier).to.be.undefined;
    expectRange(Range3d.fromJSON(batchDescr.range), 0, 0, 2, 10, 5, 2);

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).to.be.true;
    expect(branch.branch.entries.length).to.equal(1);

    const batch = branch.branch.entries[0] as Batch;
    expect(batch instanceof Batch).to.be.true;

    expect(batch.options.noFlash).to.be.true;
    expect(batch.options.locateOnly).to.be.true;
    expect(batch.options.noHilite).to.be.false;
    expect(batch.options.noEmphasis).to.be.undefined;
    expect(batch.locateOnly).to.be.true;

    expect(batch.featureTable.batchModelId).to.equal("0x123");
    expect(batch.featureTable.numFeatures).to.equal(1);
    expectFeature(0, batch.featureTable, { elementId: "0x123", geometryClass: GeometryClass.Primary, subCategoryId: "0", modelId: "0x123" });

    expectRange(batch.range, 0, 0, 2, 10, 5, 2);

    const mesh = batch.graphic as MeshGraphic;
    expect(mesh instanceof MeshGraphic).to.be.true;
    expect(mesh.primitives.length).to.equal(1);
  });

  it("creates a batch containing a single full feature with a model Id", async () => {
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

    builder.addShape2d([
      new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
    ], 2);

    const descr = finish(builder);
    const batchDescr = descr.batch!;
    expect(batchDescr).not.to.be.undefined;
    expect(batchDescr.featureTable.numFeatures).to.equal(1);
    expect(batchDescr.featureTable.multiModel).to.be.false;
    expect(batchDescr.featureTable.numSubCategories).to.be.undefined;
    expect(batchDescr.modelId).to.equal("0x456");
    expectRange(Range3d.fromJSON(batchDescr.range), 0, 0, 2, 10, 5, 2);

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).to.be.true;
    expect(branch.branch.entries.length).to.equal(1);

    const batch = branch.branch.entries[0] as Batch;
    expect(batch instanceof Batch).to.be.true;

    expect(batch.featureTable.batchModelId).to.equal("0x456");
    expect(batch.featureTable.numFeatures).to.equal(1);
    expectFeature(0, batch.featureTable, { elementId: "0x123", modelId: "0x456", subCategoryId: "0x789", geometryClass: GeometryClass.Construction });

    expectRange(batch.range, 0, 0, 2, 10, 5, 2);

    const mesh = batch.graphic as MeshGraphic;
    expect(mesh instanceof MeshGraphic).to.be.true;
    expect(mesh.primitives.length).to.equal(1);
  });

  it("creates a batch containing multiple features", async () => {
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
    expect(batchDescr).not.to.be.undefined;
    expect(batchDescr.featureTable.numFeatures).to.equal(3);
    expect(batchDescr.featureTable.multiModel).to.be.false;
    expect(batchDescr.featureTable.numSubCategories).to.be.undefined;
    expect(batchDescr.modelId).to.equal("0xb1");
    expectRange(Range3d.fromJSON(batchDescr.range), 1, 1, 1, 3, 3, 3);

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context: mainContext }) as Branch;
    expect(branch instanceof Branch).to.be.true;
    expect(branch.branch.entries.length).to.equal(1);

    const batch = branch.branch.entries[0] as Batch;
    expect(batch instanceof Batch).to.be.true;

    expect(batch.featureTable.batchModelId).to.equal("0xb1");
    expect(batch.featureTable.numFeatures).to.equal(3);

    expectRange(batch.range, 1, 1, 1, 3, 3, 3);

    expectFeature(0, batch.featureTable, { elementId: "0xa1", subCategoryId: "0xc1", geometryClass: GeometryClass.Construction, modelId: "0xb1" });
    expectFeature(1, batch.featureTable, { elementId: "0xa2", subCategoryId: "0xc1", geometryClass: GeometryClass.Construction, modelId: "0xb1" });
    expectFeature(2, batch.featureTable, { elementId: "0xa3", subCategoryId: "0xc2", geometryClass: GeometryClass.Primary, modelId: "0xb1" });
  });

  // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
  // bottom right pixel.  The rest of the square is red.
  const pngData: Uint8Array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

  const gradient = Gradient.Symb.fromJSON({
    mode: 3,
    flags: 1,
    tint: 0.042133128966509004,
    shift: 3.45912515864202,
    angle: Angle.createDegrees(92.94598821201656),
    keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 230 }],
  });

  it("creates and resolves textures", async () => {
    function expectWorkerTexture(texture: WorkerTexture, type: RenderTexture.Type, source: ImageSource | ImageBuffer | URL | Gradient.Symb, transparency: TextureTransparency | undefined): void {
      expect(texture.type).to.equal(type);
      expect(texture.source.transparency).to.equal(transparency);
      if (source instanceof ImageSource) {
        expect(texture.source.imageSource).to.equal(source.data);
        expect(texture.source.format).to.equal(source.format);
      } else if (source instanceof ImageBuffer) {
        expect(texture.source.imageBuffer).to.equal(source.data);
        expect(texture.source.format).to.equal(source.format);
        expect(texture.source.width).to.equal(source.width);
      } else if (source instanceof URL) {
        expect(texture.source.url).to.equal(source.toString());
      } else {
        expect(source instanceof Gradient.Symb).to.be.true;
        expect(texture.source.gradient).to.equal(source);
      }
    }

    const wkGrad = workerContext.createGradientTexture(gradient) as WorkerTexture;
    expectWorkerTexture(wkGrad, RenderTexture.Type.Normal, gradient, undefined);

    const imgBuf = ImageBuffer.create(
      new Uint8Array([255, 0, 0, 0, 255, 0, 0, 63, 255, 0, 0, 127, 255, 0, 0, 191]),
      ImageBufferFormat.Rgba,
      2
    );

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
    expect(pngUrl).not.to.be.undefined;
    const url = new URL(pngUrl);
    const wkUrl = workerContext.createTexture({
      source: url,
    }) as WorkerTexture;
    expectWorkerTexture(wkUrl, RenderTexture.Type.Normal, url, undefined);

    const xfers = new Set<Transferable>();
    const contextProps = workerContext.toProps(xfers);
    expect(xfers.size).to.equal(2);
    expect(Array.from(xfers).every((x) => x instanceof ArrayBuffer)).to.be.true;

    const iModel = createIModel();
    const context = await IModelApp.renderSystem.resolveGraphicDescriptionContext(contextProps, iModel);
    expect(context[_textures].size).to.equal(4);
  });

  function expectMaterial(mat: Material, expected: Partial<RenderMaterial.Params>): void {
    expect(mat.params).not.to.be.undefined;
    const actual = {
      ...mat.params,
      textureMapping: undefined,
      alpha: mat.params!.alpha,
      _alpha: undefined, // stupid class instead of interface
    };
    delete actual._alpha;

    expected = {
      ...RenderMaterial.Params.defaults,
      diffuseColor: undefined,
      alpha: undefined,
      ...expected,
      textureMapping: undefined,
    };
    
    expect(actual).to.deep.equal(expected);
  }

  it("creates a graphic containing materials and textures", async () => {
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.WorldDecoration, context: workerContext, computeChordTolerance });
    const addShape = () => {
      builder.addShape2d([
        new Point2d(0, 0), new Point2d(10, 0), new Point2d(10, 5), new Point2d(0, 5),
      ], 2);
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
    const imgBuf = ImageBuffer.create(
      new Uint8Array([255, 0, 0, 0, 255, 0, 0, 63, 255, 0, 0, 127, 255, 0, 0, 191]),
      ImageBufferFormat.Rgba,
      2
    );
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
    expect(description.primitives.length).to.equal(6);

    // NOTE: The ordering of the primitives is based on the ordering of their DisplayParams, which can change from run to run because
    // materials and textures are assigned GUIDs for ordered comparisons.
    // Figure out what order they ended up in so we can test their properties.
    const meshIndices = description.primitives.map((primitive) => {
      expect(primitive.type).to.equal("mesh");
      const params = (primitive.params as ImdlModel.MeshParams).surface;
      if (params.textureMapping === undefined) {
        // The first mesh we created has only a material - no texture.
        return 0;
      } else if (params.material === undefined) {
        // We use the same gradient twice above, so we end up reusing the texture created from it for two meshes.
        // The last mesh uses the gradient directly, so has no material.
        expect(params.textureMapping.texture).to.equal("0");
        return 5;
      } else {
        expect(typeof params.textureMapping.texture).to.equal("string");
        const txIndex = Number.parseInt(params.textureMapping.texture as string, 10);
        expect(Number.isNaN(txIndex)).to.be.false;
        expect(txIndex).least(0);
        expect(txIndex).most(4);
        return txIndex + 1;
      }
    });
    
    const context = await IModelApp.renderSystem.resolveGraphicDescriptionContext(workerContext.toProps(new Set()), createIModel());
    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description, context }) as Branch;
    expect(branch).not.to.be.undefined;
    expect(branch instanceof Branch).to.be.true;
    expect(branch.branch.entries.length).to.equal(1);

    const array = branch.branch.entries[0] as GraphicsArray;
    expect(array instanceof GraphicsArray).to.be.true;
    expect(array.graphics.length).to.equal(6);
    
    const meshes = array.graphics as MeshGraphic[];
    expect(meshes.every((x) => x instanceof MeshGraphic));

    for (let i = 0; i < meshes.length; i++) {
      const index = meshIndices.indexOf(i);
      console.log(`${i} => ${index}`);
      expect(index).least(0);
      const mesh = meshes[index];
      expect(mesh.meshData.texture === undefined).to.equal(i === 0);

      if (i === 5) {
        expect(mesh.meshData.materialInfo).to.be.undefined;
        continue;
      }

      expect(mesh.meshData.materialInfo?.isAtlas).to.be.false;
      const mat = mesh.meshData.materialInfo as Material;
      expect(mat instanceof Material).to.be.true;
      
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
          expectMaterial(mat, { alpha: 0.75, });
          break;
        case 3:
        case 4:
          expectMaterial(mat, { });
          break;
      }
    }
  });

  describe("Worker", () => {
    const createWorker = () => createWorkerProxy<TestWorker>("./test-worker.js");

    it("throws on invalid context", async () => {
      const worker = createWorker();
      await expect(worker.createGraphic({ } as any)).to.be.eventually.rejectedWith("Invalid WorkerGraphicDescriptionContextProps");
      worker.terminate();
      expect(worker.isTerminated).to.be.true;
    });

    function expectTransientId(id: string, expectedLocalId: number): void {
      expect(Id64.isTransient(id)).to.be.true;
      expect(Id64.getLocalId(id)).to.equal(expectedLocalId);
    }

    function makeTransientId(localId: number): Id64String {
      return Id64.fromLocalAndBriefcaseIds(localId, 0xffffff);
    }

    it("creates a graphic description", async () => {
      const worker = createWorker();

      const iModel = createIModel();
      const workerContext = IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel);
      const result = await worker.createGraphic(workerContext);
      expect(result.description).not.to.be.undefined;
      expect(result.context).not.to.be.undefined;

      worker.terminate();

      const d = result.description as GraphicDescriptionImpl;

      expect(d.translation!.x).to.equal(5);
      expect(d.translation!.y).to.equal(10);
      expect(d.translation!.z).to.equal(-1);

      expect(d.batch).not.to.be.undefined;
      expect(d.batch!.featureTable.numFeatures).to.equal(3);
      expectTransientId(d.batch!.modelId, 2);
      expectRange(Range3d.fromJSON(d.batch!.range), 0, 0, -4, 10, 20, 2);

      expect(d.primitives.length).to.equal(3);
      expect(d.primitives[0].type).to.equal("mesh");
      expect(d.primitives[1].type).to.equal("polyline");
      expect(d.primitives[2].type).to.equal("point");
      for (const primitive of d.primitives) {
        expect(primitive.modifier!.type).to.equal("viewIndependentOrigin");
        const origin = (primitive.modifier as ImdlModel.ViewIndependentOrigin).origin;
        expect(origin.x).to.equal(0);
        expect(origin.y).to.equal(1);
        expect(origin.z).to.equal(2);
      }
    });

    it("remaps transient Ids and creates a RenderGraphic", async () => {
      const transientIds = new TransientIdSequence();
      expectTransientId(transientIds.getNext(), 1);

      const iModel = createIModel();
      const worker = createWorker();
      const result = await worker.createGraphic(IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel));
      worker.terminate();

      expectTransientId(transientIds.getNext(), 2);
      expectTransientId(transientIds.getNext(), 3);

      const resolvedContext = await IModelApp.renderSystem.resolveGraphicDescriptionContext(result.context, iModel);
      const graphic = await IModelApp.renderSystem.createGraphicFromDescription({ context: resolvedContext, description: result.description });
      expect(graphic).not.to.be.undefined;

      const branch = graphic as Branch;
      expect(branch.branch.entries.length).to.equal(1);
      const batch = branch.branch.entries[0] as Batch;
      expect(batch instanceof Batch).to.be.true;

      // TestWorker.createWorker assigns the following Ids, starting with transient local Id 2 because we allocated 1 above.
      //   modelId: 0xffffff0000000003
      //   point string: elem 0xffffff00000000002, subcat 0xffffff0000000004, class Construction
      //   shape: elem 0xffffff0000000005 subcat: 0x123 class: Primary
      //   polyline: elem 0x456 subcat: 0xffffff0000000006 class: Primary
      // The  transient Ids should be remapped so that their local Ids are increased by 2, because we allocated 2 more transient Ids before resolving the context.
      const ft = batch.featureTable;
      expect(ft.numFeatures).to.equal(3);
      const modelId = ft.batchModelId;
      expectTransientId(modelId, 5);
      expectFeature(0, ft, { elementId: makeTransientId(4), subCategoryId: makeTransientId(6), geometryClass: GeometryClass.Construction, modelId });
      expectFeature(1, ft, { elementId: makeTransientId(7), subCategoryId: "0x123", geometryClass: GeometryClass.Primary, modelId });
      expectFeature(2, ft, { elementId: "0x456", subCategoryId: makeTransientId(8), geometryClass: GeometryClass.Primary, modelId });

      const list = batch.graphic as GraphicsArray;
      expect(list instanceof GraphicsArray).to.be.true;
      expect(list.graphics.length).to.equal(3);
      expect(list.graphics[0] instanceof MeshGraphic).to.be.true;
    });
  });
});

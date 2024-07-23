/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point2d, Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { ColorDef, EmptyLocalization, Feature, GeometryClass, LinePixels, ModelFeature, RenderFeatureTable } from "@itwin/core-common";
import { createWorkerProxy } from "../../common/WorkerProxy";
import { TestWorker } from "../worker/test-worker";
import { IModelApp } from "../../IModelApp";
import { MeshGraphic } from "../../render/webgl/Mesh";
import { GraphicDescriptionBuilder, GraphicDescriptionBuilderOptions, GraphicDescriptionConstraints, GraphicDescriptionContext, WorkerGraphicDescriptionContext } from "../../common";
import { GraphicType } from "../../common/render/GraphicType";
import { GraphicDescriptionImpl, isGraphicDescription } from "../../common/internal/render/GraphicDescriptionBuilderImpl";
import { Batch, Branch, GraphicsArray } from "../../webgl";
import { ImdlModel } from "../../common/imdl/ImdlModel";
import { Id64, Id64String, TransientIdSequence } from "@itwin/core-bentley";

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

describe("GraphicDescriptionBuilder", () => {
  let constraints: GraphicDescriptionConstraints;
  let context: GraphicDescriptionContext;

  before(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });

    // The context stuff is not really relevant to these tests because we're not passing data to worker threads and
    // we're not allocating transient Ids.
    const iModel = { transientIds: new TransientIdSequence() } as any;
    const contextProps  = IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel);
    const workerContext = WorkerGraphicDescriptionContext.fromProps(contextProps);
    constraints = workerContext.constraints;
    context = await IModelApp.renderSystem.resolveGraphicDescriptionContext(workerContext.toProps(new Set()), iModel);
  });

  after(async () => IModelApp.shutdown());

  const computeChordTolerance = () => 0;
  const graphicTypes = [GraphicType.ViewBackground, GraphicType.Scene, GraphicType.WorldDecoration, GraphicType.WorldOverlay, GraphicType.ViewOverlay];

  function expectOption(options: Omit<GraphicDescriptionBuilderOptions, "constraints" | "computeChordTolerance">, option: "wantEdges" | "wantNormals" | "preserveOrder", expected: boolean): void {
    const builder = GraphicDescriptionBuilder.create({ ...options, constraints, computeChordTolerance });
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
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.ViewOverlay, constraints, computeChordTolerance });
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

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context }) as Branch;
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
    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.Scene, constraints, computeChordTolerance });
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

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context }) as Branch;
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
      constraints,
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

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context }) as Branch;
    const mesh = branch.branch.entries[0] as MeshGraphic;
    expect(mesh.primitives.length).to.equal(1);
    expectRange(mesh.meshRange, -5, -2.5, 0, 5, 2.5, 0);
  });

  it("creates a view-independent graphic", async () => {
    const viewIndependentOrigin = new Point3d(6, 7, 8);
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldDecoration,
      constraints,
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

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context }) as Branch;
    const mesh = branch.branch.entries[0] as MeshGraphic;
    const geom = mesh.primitives[0].cachedGeometry;
    expect(geom.viewIndependentOrigin!.isExactEqual(viewIndependentOrigin)).to.be.true;
  });

  it("creates a batch containing a single feature with only an Id", async () => {
    const builder = GraphicDescriptionBuilder.create({
      type: GraphicType.WorldOverlay,
      constraints,
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

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context }) as Branch;
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
      constraints,
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

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context }) as Branch;
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
      constraints,
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

    const branch = await IModelApp.renderSystem.createGraphicFromDescription({ description: descr, context }) as Branch;
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

      const iModel = { transientIds: new TransientIdSequence() } as any;
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

      const iModel = { transientIds } as any;
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

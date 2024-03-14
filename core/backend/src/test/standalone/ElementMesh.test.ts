/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import {
  Loop, Path, Point3d, PolyfaceBuilder, Range3d, StrokeOptions,
} from "@itwin/core-geometry";
import {
  Code, ColorDef, GeometricElement3dProps, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamEntryProps, IModel, readElementMeshes,
} from "@itwin/core-common";
import {
  GenericSchema, GeometryPart, PhysicalModel, PhysicalObject, PhysicalPartition, SnapshotDb, SpatialCategory, SubjectOwnsPartitionElements,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("generateElementMeshes", () => {
  let imodel: SnapshotDb;
  let modelId: string;
  let categoryId: string;

  before(() => {
    imodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("generateElementMeshes", `${Guid.createValue()}.bim`), {
      rootSubject: { name: "generateElementMeshes", description: "generateElementMeshes" },
    });

    GenericSchema.registerSchema();
    imodel.channels.addAllowedChannel("shared");
    const partitionId = imodel.elements.insertElement({
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      code: PhysicalPartition.createCode(imodel, IModel.rootSubjectId, `PhysicalPartition_${Guid.createValue()}`),
    });

    const model = imodel.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    });

    modelId = imodel.models.insertModel(model.toJSON());
    categoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "cat", { color: ColorDef.blue.toJSON() });
  });

  after(() => {
    imodel.close();
  });

  it("throws if source is not a geometric element", async () => {
    await expect(imodel.nativeDb.generateElementMeshes({ source: "NotAnId" })).rejectedWith("Geometric element required");
  });

  function insertTriangleElement(origin = [0, 0, 0]): string {
    const bldr = new GeometryStreamBuilder();
    bldr.appendGeometryParamsChange(new GeometryParams(categoryId));
    bldr.appendGeometry(Loop.createPolygon([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(0, 1, 0), new Point3d(0, 0, 0)]));
    return insertElement(bldr.geometryStream, origin);
  }

  function insertElement(geom: GeometryStreamEntryProps[], origin = [0, 0, 0]): string {
    const props: GeometricElement3dProps = {
      classFullName: PhysicalObject.classFullName,
      model: modelId,
      code: Code.createEmpty(),
      category: categoryId,
      geom,
      placement: {
        origin,
        angles: {},
      },
    };

    const elemId = imodel.elements.insertElement(props);
    expect(Id64.isValidId64(elemId)).to.be.true;
    return elemId;
  }

  it("produces a polyface", async () => {
    const source = insertTriangleElement();
    const bytes = await imodel.nativeDb.generateElementMeshes({ source });
    const meshes = readElementMeshes(bytes);
    expect(meshes.length).to.equal(1);
    expect(meshes[0].range().isAlmostEqual(new Range3d(0, 0, 0, 1, 1, 0))).to.be.true;
  });

  it("applies element placement transform", async () => {
    const source = insertTriangleElement([5, 0, -2]);
    const bytes = await imodel.nativeDb.generateElementMeshes({ source });
    const meshes = readElementMeshes(bytes);
    expect(meshes.length).to.equal(1);
    expect(meshes[0].range().isAlmostEqual(new Range3d(5, 0, -2, 6, 1, -2))).to.be.true;
  });

  it("applies part reference transform", async () => {
    const ptBldr = new GeometryStreamBuilder();
    ptBldr.appendGeometry(Loop.createPolygon([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(0, 1, 0), new Point3d(0, 0, 0)]));
    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: GeometryPart.createCode(imodel, IModel.dictionaryId, Guid.createValue()),
      geom: ptBldr.geometryStream,
    };

    const partId = imodel.elements.insertElement(partProps);
    expect(Id64.isValidId64(partId)).to.be.true;

    const elBldr = new GeometryStreamBuilder();
    elBldr.appendGeometryParamsChange(new GeometryParams(categoryId));
    elBldr.appendGeometryPart3d(partId, new Point3d(0, 0, 1));
    elBldr.appendGeometryPart3d(partId, new Point3d(0, 0, -1));
    const source = insertElement(elBldr.geometryStream, [2, -4, 0]);

    const bytes = await imodel.nativeDb.generateElementMeshes({ source });
    const meshes = readElementMeshes(bytes);
    expect(meshes.length).to.equal(2);
    expect(meshes[0].range().isAlmostEqual(new Range3d(2, -4, 1, 3, -3, 1))).to.be.true;
    expect(meshes[1].range().isAlmostEqual(new Range3d(2, -4, -1, 3, -3, -1))).to.be.true;
  });

  it("produces multiple polyfaces", async () => {
    const bldr = new GeometryStreamBuilder();
    bldr.appendGeometryParamsChange(new GeometryParams(categoryId));
    bldr.appendGeometry(Loop.createPolygon([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(0, 1, 0), new Point3d(0, 0, 0)]));
    bldr.appendGeometry(Loop.createPolygon([new Point3d(0, 0, 5), new Point3d(1, 0, 5), new Point3d(0, 1, 5), new Point3d(0, 0, 5)]));
    const source = insertElement(bldr.geometryStream);

    const meshes = readElementMeshes(await imodel.nativeDb.generateElementMeshes({ source }));
    expect(meshes.length).to.equal(2);
    expect(meshes[0].range().isAlmostEqual(new Range3d(0, 0, 0, 1, 1, 0))).to.be.true;
    expect(meshes[1].range().isAlmostEqual(new Range3d(0, 0, 5, 1, 1, 5))).to.be.true;
  });

  it("ignores open curves", async () => {
    const bldr = new GeometryStreamBuilder();
    bldr.appendGeometryParamsChange(new GeometryParams(categoryId));
    bldr.appendGeometry(Loop.createPolygon([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(0, 1, 0), new Point3d(0, 0, 0)]));
    bldr.appendGeometry(Path.create([new Point3d(0, 0, 0), new Point3d(1, 1, 1)]));
    bldr.appendGeometry(Loop.createPolygon([new Point3d(0, 0, 5), new Point3d(1, 0, 5), new Point3d(0, 1, 5), new Point3d(0, 0, 5)]));
    const source = insertElement(bldr.geometryStream);

    const meshes = readElementMeshes(await imodel.nativeDb.generateElementMeshes({ source }));
    expect(meshes.length).to.equal(2);
    expect(meshes[0].range().isAlmostEqual(new Range3d(0, 0, 0, 1, 1, 0))).to.be.true;
    expect(meshes[1].range().isAlmostEqual(new Range3d(0, 0, 5, 1, 1, 5))).to.be.true;
  });

  it("omits normals and UVs", async () => {
    const opts = new StrokeOptions();
    opts.needNormals = opts.needParams = true;
    const pfBldr = PolyfaceBuilder.create(opts);
    pfBldr.addTriangleFacet([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(0, 1, 0)]);
    const pf = pfBldr.claimPolyface();
    expect(pf.pointCount).to.equal(3);
    expect(pf.normalCount).least(1);
    expect(pf.paramCount).least(1);

    const bldr = new GeometryStreamBuilder();
    bldr.appendGeometryParamsChange(new GeometryParams(categoryId));
    bldr.appendGeometry(pf);
    const source = insertElement(bldr.geometryStream, [10, 0, 0]);

    const bytes = await imodel.nativeDb.generateElementMeshes({ source });
    const meshes = readElementMeshes(bytes);
    expect(meshes.length).to.equal(1);
    expect(meshes[0].pointCount).to.equal(3);
    expect(meshes[0].paramCount).to.equal(0);
    expect(meshes[0].normalCount).to.equal(0);
    expect(meshes[0].range().isAlmostEqual(new Range3d(10, 0, 0, 11, 1, 0))).to.be.true;
  });
});

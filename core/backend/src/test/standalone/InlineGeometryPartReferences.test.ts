/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { CoordinateXYZ, Point3d, Range3dProps } from "@itwin/core-geometry";
import {
  ColorDef, GeometryParams, GeometryStreamBuilder, GeometryStreamIterator, IModel,
} from "@itwin/core-common";
import {
  GenericSchema, PhysicalModel, PhysicalPartition, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, SubjectOwnsPartitionElements,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

interface Point { x: number, y: number, z: number };

interface PartRef {
  partId: string;
  origin?: Point;
}

interface Symbology {
  categoryId?: string;
  subCategoryId?: string;
  color?: ColorDef;
  materialId?: string;
}

function makeGeomParams(symb: Symbology): GeometryParams {
  const params = new GeometryParams(symb.categoryId ?? Id64.invalid, symb.subCategoryId);
  params.fillColor = params.lineColor = symb.color;
  params.materialId = symb.materialId;
  return params;
}

type UnionMember<T, U> = T & { [k in keyof U]?: never };

type GeomWriterEntry =
  UnionMember<PartRef, Symbology & Point> |
  UnionMember<Symbology, PartRef & Point> |
  UnionMember<Point, PartRef & Symbology>;

class GeomWriter {
  public readonly builder: GeometryStreamBuilder;

  public constructor(symbology?: Symbology) {
    this.builder = new GeometryStreamBuilder();
    if (symbology)
      this.append(symbology);
  }

  public append(entry: GeomWriterEntry): void {
    if (entry.partId)
      this.builder.appendGeometryPart3d(entry.partId, Point3d.fromJSON(entry.origin));
    else if (entry.subCategoryId || entry.categoryId || entry.color || entry.materialId)
      this.builder.appendGeometryParamsChange(makeGeomParams(entry));
    else if (undefined !== entry.x)
      this.builder.appendGeometry(CoordinateXYZ.createXYZ(entry.x, entry.y, entry.z));
  }
}

interface SubRange { lo: Point, hi: Point };

type GeomStreamEntry =
  "header" |
  UnionMember<PartRef, Symbology & SubRange & Point> |
  UnionMember<Symbology, PartRef & SubRange & Point> |
  UnionMember<SubRange, PartRef & Symbology & Point> |
  UnionMember<Point, PartRef & Symbology & SubRange>;

function readGeomStream(iter: GeometryStreamIterator): GeomStreamEntry[] {
  const result: GeomStreamEntry[] = [];
  for (const entry of iter) {
    result.push({
      categoryId: entry.geomParams.categoryId,
      subCategoryId: entry.geomParams.subCategoryId,
      color: entry.geomParams.fillColor,
      materialId: entry.geomParams.materialId,
    });

    if (entry.localRange) {
      result.push({
        lo: { x: entry.localRange.low.x, y: entry.localRange.low.y, z: entry.localRange.low.z },
        hi: { x: entry.localRange.high.x, y: entry.localRange.high.y, z: entry.localRange.high.z },
      });
    }

    expect(entry.primitive.type).to.equal("geometryQuery");
    if (entry.primitive.type === "geometryQuery") {
      expect(entry.primitive.geometry.geometryCategory).to.equal("point");
      if (entry.primitive.geometry.geometryCategory === "point") {
        const pt = entry.primitive.geometry.point;
        result.push({ x: pt.x, y: pt.y, z: pt.z });
      }
    }
  }

  return result;
}

describe.only("DgnDb.inlineGeometryPartReferences", () => {
  let imodel: SnapshotDb;
  let modelId: string;
  let categoryId: string;
  let blueSubCategoryId: string;
  let redSubCategoryId: string;
  let materialId: string;

  beforeEach(() => {
    imodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("InlineGeomParts", `${Guid.createValue()}.bim`), {
      rootSubject: { name: "InlineGeomParts", description: "InlineGeomParts" },
    });

    GenericSchema.registerSchema();
    const partitionId = imodel.elements.insertElement({
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      code: PhysicalPartition.createCode(imodel, IModel.rootSubjectId, `PhysicalPartition_${Guid.createValue()}`),
    });

    expect(Id64.isValidId64(partitionId)).to.be.true;
    const model = imodel.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    });

    expect(model).instanceOf(PhysicalModel);

    modelId = imodel.models.insertModel(model.toJSON());
    expect(Id64.isValidId64(modelId)).to.be.true;

    categoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "ctgry", { color: ColorDef.blue.toJSON() });
    expect(Id64.isValidId64(categoryId)).to.be.true;
    blueSubCategoryId = IModel.getDefaultSubCategoryId(categoryId);
    redSubCategoryId = SubCategory.insert(imodel, categoryId, "red", { color: ColorDef.red.toJSON() });
    expect(Id64.isValidId64(redSubCategoryId)).to.be.true;

    materialId = RenderMaterialElement.insert(imodel, IModel.dictionaryId, "mat", { paletteName: "pal" });
    expect(Id64.isValidId64(materialId)).to.be.true;
  });

  afterEach(() => {
    imodel.close();
  });

  it("inlines and deletes a simple unique part reference", () => {
  });

  it("inlines and deletes unique parts, ignoring non-unique parts", () => {
  });

  it("applies part transform", () => {
  });

  it("inlines multiple references in a single element", () => {
  });

  it("resets element symbology", () => {
  });

  it("has no effect if inlining fails", () => {
  });

  it("preserves subgraphic ranges", () => {
  });

  it("inserts subgraphic ranges for subsequent geometry", () => {
  });
});

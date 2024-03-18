/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { LineString3d, Loop, Point3d } from "@itwin/core-geometry";
import {
  AreaPattern,
  Code, ColorDef, GeometricElement3dProps, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamIterator, IModel,
} from "@itwin/core-common";
import {
  GenericSchema, GeometricElement3d, GeometryPart, PhysicalModel, PhysicalObject, PhysicalPartition, RenderMaterialElement, SnapshotDb, SpatialCategory, SubCategory, SubjectOwnsPartitionElements,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

// The only geometry in our geometry streams will be squares of 1 meter in x and y, with origin at (pos, 0, 0).
interface Primitive { pos: number }

interface PartRef {
  partId: string;
  origin?: number; // origin in X. y and z are zero.
}

interface Symbology {
  categoryId?: string;
  subCategoryId?: string;
  color?: ColorDef;
  materialId?: string;
  patternOrigin?: number;
}

function makeGeomParams(symb: Symbology): GeometryParams {
  const params = new GeometryParams(symb.categoryId ?? Id64.invalid, symb.subCategoryId);
  params.lineColor = symb.color;
  params.materialId = symb.materialId;
  if (symb.patternOrigin)
    params.pattern = AreaPattern.Params.fromJSON({ origin: [symb.patternOrigin, 0, 0] });

  return params;
}

interface AppendSubRanges { appendSubRanges: true }

type UnionMember<T, U> = T & { [k in keyof U]?: never };

type GeomWriterEntry =
  UnionMember<PartRef, Symbology & Primitive & AppendSubRanges> |
  UnionMember<Symbology, PartRef & Primitive & AppendSubRanges> |
  UnionMember<Primitive, PartRef & Symbology & AppendSubRanges> |
  UnionMember<AppendSubRanges, Symbology & Primitive & PartRef>;

class GeomWriter {
  public readonly builder: GeometryStreamBuilder;

  public constructor(symbology?: Symbology) {
    this.builder = new GeometryStreamBuilder();
    if (symbology)
      this.append(symbology);
  }

  public append(entry: GeomWriterEntry): void {
    if (entry.partId)
      this.builder.appendGeometryPart3d(entry.partId, new Point3d(entry.origin, 0, 0));
    else if (entry.subCategoryId || entry.categoryId || entry.color || entry.materialId || entry.patternOrigin)
      this.builder.appendGeometryParamsChange(makeGeomParams(entry));
    else if (undefined !== entry.pos)
      this.builder.appendGeometry(Loop.createPolygon([new Point3d(entry.pos, 0, 0), new Point3d(entry.pos + 1, 0, 0), new Point3d(entry.pos + 1, 1, 0), new Point3d(entry.pos, 1, 0)]));
    else if (undefined !== entry.appendSubRanges)
      this.builder.appendGeometryRanges();
  }
}

// SubGraphicRange where x dimension is 1 meter and y and z are empty.
interface SubRange { low: number }

type GeomStreamEntry =
  UnionMember<PartRef, Symbology & SubRange & Primitive> |
  UnionMember<Symbology, PartRef & SubRange & Primitive> |
  UnionMember<SubRange, PartRef & Symbology & Primitive> |
  UnionMember<Primitive, PartRef & Symbology & SubRange>;

function readGeomStream(iter: GeometryStreamIterator): GeomStreamEntry[] & { viewIndependent: boolean } {
  const result: GeomStreamEntry[] = [];
  for (const entry of iter) {
    const symb: Symbology =  { categoryId: entry.geomParams.categoryId, subCategoryId: entry.geomParams.subCategoryId };

    if (undefined !== entry.geomParams.lineColor)
      symb.color = entry.geomParams.lineColor;

    if (undefined !== entry.geomParams.materialId)
      symb.materialId = entry.geomParams.materialId;

    if (entry.geomParams.pattern) {
      expect(entry.geomParams.pattern.origin).not.to.be.undefined;
      symb.patternOrigin = entry.geomParams.pattern.origin!.x;
    }

    result.push(symb);

    if (entry.localRange) {
      expect(entry.localRange.low.y).to.equal(0);
      expect(entry.localRange.low.z).to.equal(0);
      expect(entry.localRange.high.y).to.equal(1);
      expect(entry.localRange.high.z).to.equal(0);
      expect(entry.localRange.high.x - entry.localRange.low.x).to.equal(1);

      result.push({ low: entry.localRange.low.x });
    }

    if (entry.primitive.type === "geometryQuery") {
      expect(entry.primitive.geometry.geometryCategory).to.equal("curveCollection");
      if (entry.primitive.geometry.geometryCategory === "curveCollection") {
        expect(entry.primitive.geometry.children.length).to.equal(1);
        expect(entry.primitive.geometry.children[0]).instanceOf(LineString3d);

        const pts = (entry.primitive.geometry.children[0] as LineString3d).points;
        expect(pts.length).to.equal(5);
        expect(pts[1].x).to.equal(pts[0].x + 1);

        result.push({ pos: pts[0].x });
      }
    } else {
      expect(entry.primitive.type).to.equal("partReference");
      if (entry.primitive.type === "partReference") {
        const partRef: PartRef = { partId: entry.primitive.part.id };
        if (entry.primitive.part.toLocal)
          partRef.origin = entry.primitive.part.toLocal.origin.x;

        result.push(partRef);
      }
    }
  }

  (result as any).viewIndependent = iter.isViewIndependent;
  return result as GeomStreamEntry[] & { viewIndependent: boolean };
}

describe("DgnDb.inlineGeometryPartReferences", () => {
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

  function insertGeometryPart(geom: GeomWriterEntry[]): string {
    const writer = new GeomWriter();
    for (const entry of geom)
      writer.append(entry);

    const props: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: GeometryPart.createCode(imodel, IModel.dictionaryId, Guid.createValue()),
      geom: writer.builder.geometryStream,
    };

    const partId = imodel.elements.insertElement(props);
    expect(Id64.isValidId64(partId)).to.be.true;
    return partId;
  }

  function insertElement(geom: GeomWriterEntry[], viewIndependent = false): string {
    const writer = new GeomWriter({ categoryId });
    if (viewIndependent)
      writer.builder.isViewIndependent = true;

    for (const entry of geom)
      writer.append(entry);

    const props: GeometricElement3dProps = {
      classFullName: PhysicalObject.classFullName,
      model: modelId,
      code: Code.createEmpty(),
      category: categoryId,
      geom: writer.builder.geometryStream,
      placement: {
        origin: [0, 0, 0],
        angles: { },
      },
    };

    const elemId = imodel.elements.insertElement(props);
    expect(Id64.isValidId64(elemId)).to.be.true;
    return elemId;
  }

  function readElementGeom(id: string): GeomStreamEntry[] & { viewIndependent: boolean } {
    let iter;
    const elem = imodel.elements.getElement({ id, wantGeometry: true });
    if (elem instanceof GeometryPart) {
      iter = GeometryStreamIterator.fromGeometryPart(elem);
    } else {
      expect(elem).instanceOf(GeometricElement3d);
      iter = GeometryStreamIterator.fromGeometricElement3d(elem as GeometricElement3d);
    }

    return readGeomStream(iter);
  }

  function expectGeom(actual: GeomStreamEntry[], expected: GeomStreamEntry[]): void {
    expect(actual).to.deep.equal(expected);
  }

  function inlinePartRefs(): number {
    const result = imodel.nativeDb.inlineGeometryPartReferences();
    expect(result.numCandidateParts).to.equal(result.numPartsDeleted);
    expect(result.numRefsInlined).to.equal(result.numCandidateParts);
    return result.numRefsInlined;
  }

  it("inlines and deletes a simple unique part reference", () => {
    // Create single reference to a part and perform sanity checks on our geometry validation code.
    const partId = insertGeometryPart([{ pos: 123 }]);
    expectGeom(readElementGeom(partId), [
      { categoryId: "0", subCategoryId: "0" },
      { pos: 123 },
    ]);

    const elemId = insertElement([{ partId }]);
    expectGeom(readElementGeom(elemId), [
      { categoryId, subCategoryId: blueSubCategoryId },
      { partId },
    ]);

    // Inline and delete the part.
    expect(inlinePartRefs()).to.equal(1);
    expect(imodel.elements.tryGetElement(partId)).to.be.undefined;

    const geom = readElementGeom(elemId);
    expect(geom.viewIndependent).to.be.false;
    expectGeom(geom, [
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 123 },
      { pos: 123 },
    ]);
  });

  it("inlines and deletes unique parts, ignoring non-unique parts", () => {
    const part1 = insertGeometryPart([{ pos: 1 }]);
    const part2 = insertGeometryPart([{ pos: 2 }]);
    const part3 = insertGeometryPart([{ pos: 3 }]);
    const part4 = insertGeometryPart([{ pos: 4 }]);

    const elem1 = insertElement([{ partId: part1 }]);
    const elem2 = insertElement([{ partId: part2 }, { partId: part3 }]);
    const elem3 = insertElement([{ partId: part3 }]);
    const elem4 = insertElement([{ partId: part4 }]);
    const elem5 = insertElement([{ partId: part4 }]);

    expect(inlinePartRefs()).to.equal(2);

    const symb = { categoryId, subCategoryId: blueSubCategoryId };
    expectGeom(readElementGeom(elem1), [symb, { low: 1 }, { pos: 1 }]);
    expectGeom(readElementGeom(elem2), [symb, { low: 2 }, { pos: 2 }, symb, { partId: part3 }]);
    expectGeom(readElementGeom(elem3), [symb, { partId: part3 }]);
    expectGeom(readElementGeom(elem4), [symb, { partId: part4 }]);
    expectGeom(readElementGeom(elem5), [symb, { partId: part4 }]);
  });

  it("applies part transform", () => {
    const partId = insertGeometryPart([{ pos: -8 }]);
    const elemId = insertElement([{ partId, origin: 50 }]);
    expect(inlinePartRefs()).to.equal(1);
    expectGeom(readElementGeom(elemId), [
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 42 },
      { pos: 42 },
    ]);
  });

  it("applies element symbology to part and resets element symbology after embedding part", () => {
    const part1 = insertGeometryPart([
      { pos: 1 },
      { color: ColorDef.green },
      { pos: 1.5},
    ]);

    const part2 = insertGeometryPart([
      { pos: 2 },
      { materialId },
      { pos: 2.5 },
    ]);

    // Sanity check.
    expectGeom(readElementGeom(part2), [
      { categoryId: "0", subCategoryId: "0" },
      { pos: 2 },
      { categoryId: "0", subCategoryId: "0", materialId },
      { pos: 2.5 },
    ]);

    const part3 = insertGeometryPart([
      { pos: 3 },
      { materialId: "0" },
      { pos: 3.5 },
    ]);

    const elemId = insertElement([
      { pos: -1 },
      { subCategoryId: redSubCategoryId },
      { partId: part1 },
      { pos: -2 },
      { color: ColorDef.black },
      { partId: part2 },
      { pos: -3 },
      { materialId, color: ColorDef.white },
      { partId: part3 },
      { pos: -4 },
    ]);

    expect(inlinePartRefs()).to.equal(3);

    expectGeom(readElementGeom(elemId), [
      { categoryId, subCategoryId: blueSubCategoryId },
      { pos: -1 },
      { categoryId, subCategoryId: redSubCategoryId },
      { low: 1},
      { pos: 1 },
      { categoryId, subCategoryId: redSubCategoryId, color: ColorDef.green },
      { low: 1.5 },
      { pos: 1.5 },
      { categoryId, subCategoryId: redSubCategoryId },
      { low: -2 },
      { pos: -2 },

      { categoryId, subCategoryId: redSubCategoryId, color: ColorDef.black },
      { low: 2 },
      { pos: 2 },
      { categoryId, subCategoryId: redSubCategoryId, materialId },
      { low: 2.5 },
      { pos: 2.5 },
      { categoryId, subCategoryId: redSubCategoryId, color: ColorDef.black },
      { low: -3 },
      { pos: -3 },

      { categoryId, subCategoryId: redSubCategoryId, color: ColorDef.white, materialId },
      { low: 3 },
      { pos: 3 },
      { categoryId, subCategoryId: redSubCategoryId, materialId: "0" },
      { low: 3.5 },
      { pos: 3.5 },
      {categoryId, subCategoryId: redSubCategoryId, color: ColorDef.white, materialId },
      { low: -4 },
      { pos: -4 },
    ]);
  });

  it("inserts subgraphic ranges for parts", () => {
    const part1 = insertGeometryPart([{ pos: 1 }]);
    const part2 = insertGeometryPart([{ pos: 2 }]);
    const elem = insertElement([
      { pos: -1 },
      { partId: part1 },
      { partId: part2, origin: 5 },
    ]);

    expect(inlinePartRefs()).to.equal(2);

    expectGeom(readElementGeom(elem), [
      { categoryId, subCategoryId: blueSubCategoryId },
      { pos: -1 },
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 1 },
      { pos: 1 },
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 7 },
      { pos: 7 },
    ]);
  });

  it("preserves existing subgraphic ranges", () => {
    const partId = insertGeometryPart([{ pos: 0 }]);
    const elem = insertElement([
      { appendSubRanges: true },
      { pos: -1 },
      { partId },
      { pos: 1 },
    ]);

    expectGeom(readElementGeom(elem), [
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: -1 },
      { pos: -1 },
      { categoryId, subCategoryId: blueSubCategoryId },
      { partId },
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 1 },
      { pos: 1 },
    ]);

    expect(inlinePartRefs()).to.equal(1);

    expectGeom(readElementGeom(elem), [
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: -1 },
      { pos: -1 },
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 0 },
      { pos: 0 },
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 1 },
      { pos: 1 },
    ]);
  });

  it("inserts subgraphic ranges geometry following part", () => {
    const partId = insertGeometryPart([{ pos: 1 }]);
    const elem = insertElement([
      { pos: 0 },
      { partId },
      { pos: 2 },
    ]);

    expect(inlinePartRefs()).to.equal(1);

    expectGeom(readElementGeom(elem), [
      { categoryId, subCategoryId: blueSubCategoryId },
      { pos: 0 },
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 1 },
      { pos: 1 },
      { categoryId, subCategoryId: blueSubCategoryId },
      { low: 2 },
      { pos: 2 },
    ]);
  });

  it("applies transform to patterns", () => {
    const part1 = insertGeometryPart([{ pos: 1 }]);
    const part2 = insertGeometryPart([{ patternOrigin: 123 }, { pos: 2 }]);

    expectGeom(readElementGeom(part2), [
      { categoryId: "0", subCategoryId: "0", patternOrigin: 123 },
      { pos: 2 },
    ]);

    const elemId = insertElement([
      { patternOrigin: 456 },
      { pos: -1 },
      { partId: part1, origin: 8 },
      { pos: -2 },
      { partId: part2, origin: 12 },
      { pos: -3 },
    ]);

    expectGeom(readElementGeom(elemId), [
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { pos: -1 },
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { partId: part1, origin: 8 },
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { pos: -2 },
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { partId: part2, origin: 12 },
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { pos: -3 },
    ]);

    expect(inlinePartRefs()).to.equal(2);

    expectGeom(readElementGeom(elemId), [
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { pos: -1 },
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { low: 1 + 8 },
      { pos: 1 + 8 },
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { low: -2 },
      { pos: -2 },
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 123 + 12 },
      { low: 2 + 12 },
      { pos: 2 + 12 },
      { categoryId, subCategoryId: blueSubCategoryId, patternOrigin: 456 },
      { low: -3 },
      { pos: -3 },
    ]);
  });

  it("preserves element header flags", () => {
    const partId = insertGeometryPart([{ pos: 1 }]);
    const elemId = insertElement([{ partId }], true);
    expect(readElementGeom(elemId).viewIndependent).to.be.true;

    expect(inlinePartRefs()).to.equal(1);
    expect(readElementGeom(elemId).viewIndependent).to.be.true;
  });
});

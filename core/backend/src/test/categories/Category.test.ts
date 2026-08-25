/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { SubCategoryAppearance } from "@itwin/core-common";
import {
  DrawingCategory, IModelDb, RenderMaterialElement, RenderMaterialElementParams, SpatialCategory, StandaloneDb, SubCategory,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { EditTxn, withEditTxn } from "../../EditTxn";

describe("Category", () => {
  let imodel: StandaloneDb;
  before(() => {
    imodel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("Category", "Category.bim"), {
      rootSubject: { name: "Category tests", description: "Category tests" },
      client: "Category",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });
  });

  after(() => {
    imodel.close();
  });

  it("should insert with default subcategory appearance", () => {
    const params: RenderMaterialElementParams = {
      description: "Field Weld",
      color: [0.9058, 0.298, 0.2352],
      diffuse: 0.5,
      finish: 0.15,
      paletteName: "MyPalette",
      reflectColor: [0.9, 0.3, 0.25],
      specularColor: [0.2, 0.2, 0.2],
    };

    const materialId = withEditTxn(imodel, (txn) => RenderMaterialElement.insert(txn, IModelDb.dictionaryId, "FieldWeldMaterial", params));
    expect(Id64.isValidId64(materialId)).to.be.true;

    const appearance = new SubCategoryAppearance({ material: materialId, priority: 100, transp: 0.75 });
    const priCategoryId = withEditTxn(imodel, (txn) => SpatialCategory.insert(txn, IModelDb.dictionaryId, "FieldWeld", appearance));
    expect(Id64.isValidId64(priCategoryId)).to.be.true;

    const subCatId = imodel.elements.queryElementIdByCode(SubCategory.createCode(imodel, priCategoryId, "FieldWeld"))!;
    expect(subCatId).not.to.be.undefined;
    expect(Id64.isValidId64(subCatId)).to.be.true;
    const subCat = imodel.elements.getElement<SubCategory>(subCatId);
    expect(subCat).not.to.be.undefined;
    expect(subCat).instanceof(SubCategory);
    expect(subCat.isDefaultSubCategory).to.be.true;
    expect(subCat.appearance.priority).to.equal(100);
    expect(subCat.appearance.transparency).to.equal(0.75);
    expect(subCat.appearance.materialId).to.equal(materialId);
  });

  it("supports deprecated category insertion overloads", () => {
    const previousEnforcement = EditTxn.implicitWriteEnforcement;
    EditTxn.implicitWriteEnforcement = "allow";
    try {
      const defaultAppearance = new SubCategoryAppearance({ priority: 23, transp: 0.2 });

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const spatialCategoryId = SpatialCategory.insert(imodel, IModelDb.dictionaryId, "LegacySpatialCategory", defaultAppearance);
      expect(Id64.isValidId64(spatialCategoryId)).to.be.true;

      const spatialDefaultSubCategoryId = imodel.elements.queryElementIdByCode(SubCategory.createCode(imodel, spatialCategoryId, "LegacySpatialCategory"));
      expect(spatialDefaultSubCategoryId).not.to.be.undefined;
      const spatialDefaultSubCategory = imodel.elements.getElement<SubCategory>(spatialDefaultSubCategoryId!);
      expect(spatialDefaultSubCategory.appearance.priority).to.equal(23);
      expect(spatialDefaultSubCategory.appearance.transparency).to.equal(0.2);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const drawingCategoryId = DrawingCategory.insert(imodel, IModelDb.dictionaryId, "LegacyDrawingCategory", { priority: 31, transp: 0.4 });
      expect(Id64.isValidId64(drawingCategoryId)).to.be.true;

      const drawingDefaultSubCategoryId = imodel.elements.queryElementIdByCode(SubCategory.createCode(imodel, drawingCategoryId, "LegacyDrawingCategory"));
      expect(drawingDefaultSubCategoryId).not.to.be.undefined;
      const drawingDefaultSubCategory = imodel.elements.getElement<SubCategory>(drawingDefaultSubCategoryId!);
      expect(drawingDefaultSubCategory.appearance.priority).to.equal(31);
      expect(drawingDefaultSubCategory.appearance.transparency).to.equal(0.4);
    } finally {
      EditTxn.implicitWriteEnforcement = previousEnforcement;
    }
  });

  it("supports deprecated subcategory insertion overload", () => {
    const previousEnforcement = EditTxn.implicitWriteEnforcement;
    EditTxn.implicitWriteEnforcement = "allow";
    try {
      const categoryId = withEditTxn(imodel, (txn) => SpatialCategory.insert(txn, IModelDb.dictionaryId, "SubCategoryParent", new SubCategoryAppearance()));

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const subCategoryId = SubCategory.insert(imodel, categoryId, "legacy-child", { priority: 61, transp: 0.55 });
      expect(Id64.isValidId64(subCategoryId)).to.be.true;

      const subCategory = imodel.elements.getElement<SubCategory>(subCategoryId);
      expect(subCategory.getCategoryId()).to.equal(categoryId);
      expect(subCategory.appearance.priority).to.equal(61);
      expect(subCategory.appearance.transparency).to.equal(0.55);
    } finally {
      EditTxn.implicitWriteEnforcement = previousEnforcement;
    }
  });

  it("supports deprecated Category.setDefaultAppearance overload", () => {
    const previousEnforcement = EditTxn.implicitWriteEnforcement;
    EditTxn.implicitWriteEnforcement = "allow";
    try {
      const categoryId = withEditTxn(imodel, (txn) => SpatialCategory.insert(txn, IModelDb.dictionaryId, "SetDefaultAppearanceLegacy", new SubCategoryAppearance()));
      const category = imodel.elements.getElement<SpatialCategory>(categoryId);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      category.setDefaultAppearance({ priority: 42, transp: 0.15 });

      const defaultSubCategory = imodel.elements.getElement<SubCategory>(category.myDefaultSubCategoryId());
      expect(defaultSubCategory.appearance.priority).to.equal(42);
      expect(defaultSubCategory.appearance.transparency).to.equal(0.15);
    } finally {
      EditTxn.implicitWriteEnforcement = previousEnforcement;
    }
  });
});

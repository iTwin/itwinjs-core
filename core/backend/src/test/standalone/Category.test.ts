/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@bentley/bentleyjs-core";
import { SubCategoryAppearance } from "@bentley/imodeljs-common";
import {
  IModelDb, RenderMaterialElement, SpatialCategory, StandaloneDb, SubCategory,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

// spell-checker: disable

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
    const params: RenderMaterialElement.Params = {
      description: "Field Weld",
      color: [0.9058, 0.298, 0.2352],
      diffuse: 0.5,
      finish: 0.15,
      paletteName: "MyPalette",
      reflectColor: [0.9, 0.3, 0.25],
      specularColor: [0.2, 0.2, 0.2],
    };

    const materialId = RenderMaterialElement.insert(imodel, IModelDb.dictionaryId, "FieldWeldMaterial", params);
    expect(Id64.isValidId64(materialId)).to.be.true;

    const appearance = new SubCategoryAppearance({material: materialId, priority: 100, transp: 0.75});
    const priCategoryId = SpatialCategory.insert(imodel, IModelDb.dictionaryId, "FieldWeld", appearance);
    expect(Id64.isValidId64(priCategoryId)).to.be.true;

    const subCatId = imodel.elements.queryElementIdByCode(SubCategory.createCode(imodel, priCategoryId, "FieldWeld"))!;
    expect(subCatId).not.to.be.undefined;
    expect(Id64.isValidId64(subCatId)).to.be.true;
    const subCat = imodel.elements.getElement<SubCategory>(subCatId)!;
    expect(subCat).not.to.be.undefined;
    expect(subCat).instanceof(SubCategory);
    expect(subCat.isDefaultSubCategory).to.be.true;
    expect(subCat.appearance.priority).to.equal(100);
    expect(subCat.appearance.transparency).to.equal(0.75);
    expect(subCat.appearance.materialId).to.equal(materialId);
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { ColorDef, IModel, SubCategoryAppearance, CodeScopeSpec } from "@bentley/imodeljs-common";
import { IModelImporter, IModelJsFs } from "../../backend";
import { KnownTestLocations } from "../KnownTestLocations";

class TestImporter extends IModelImporter {
  /** Construct a new TestImporter */
  public constructor() {
    const outputDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
    const outputFile: string = path.join(outputDir, "TestImporter.bim");
    if (IModelJsFs.existsSync(outputFile))
      IModelJsFs.removeSync(outputFile);
    super(outputFile, { rootSubject: { name: "TestImporter" } });
    assert.isTrue(IModelJsFs.existsSync(outputFile));
  }

  public import(): void {
    const codeSpecId: Id64String = this.insertCodeSpec("TestCodeSpec", CodeScopeSpec.Type.Model);
    assert.isTrue(Id64.isValid(codeSpecId));
    const definitionModelId: Id64String = this.insertDefinitionModel(IModel.rootSubjectId, "Definition");
    assert.isTrue(Id64.isValid(definitionModelId));
    const physicalModelId: Id64String = this.insertPhysicalModel(IModel.rootSubjectId, "Physical");
    assert.isTrue(Id64.isValid(physicalModelId));
    const documentListModelId: Id64String = this.insertDocumentListModel(IModel.rootSubjectId, "Document");
    assert.isTrue(Id64.isValid(documentListModelId));
    const drawingId: Id64String = this.insertDrawing(documentListModelId, "Drawing");
    assert.isTrue(Id64.isValid(drawingId));
    const modelSelectorId: Id64String = this.insertModelSelector(definitionModelId, "PhysicalModels", [physicalModelId]);
    assert.isTrue(Id64.isValid(modelSelectorId));
    const spatialCategoryId: Id64String = this.insertSpatialCategory(definitionModelId, "SpatialCategory", ColorDef.red);
    assert.isTrue(Id64.isValid(spatialCategoryId));
    const drawingCategoryId: Id64String = this.insertDrawingCategory(definitionModelId, "DrawingCategory", new SubCategoryAppearance());
    assert.isTrue(Id64.isValid(drawingCategoryId));
    const spatialCategorySelectorId: Id64String = this.insertCategorySelector(definitionModelId, "SpatialCategories", [spatialCategoryId]);
    assert.isTrue(Id64.isValid(spatialCategorySelectorId));
    const displayStyle2dId: Id64String = this.insertDisplayStyle2d(definitionModelId, "DisplayStyle2d");
    assert.isTrue(Id64.isValid(displayStyle2dId));
    const displayStyle3dId: Id64String = this.insertDisplayStyle3d(definitionModelId, "DisplayStyle3d");
    assert.isTrue(Id64.isValid(displayStyle3dId));
    this.iModelDb.saveChanges();
  }
}

describe("IModelImporter", () => {

  it("should import", async () => {
    const importer = new TestImporter();
    assert.isDefined(importer);
    importer.import();
  });
});

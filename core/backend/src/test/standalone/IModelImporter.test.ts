/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { ColorDef, IModel, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { CategorySelector, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DocumentListModel, Drawing, DrawingCategory, IModelImporter, IModelJsFs, ModelSelector, PhysicalModel, SpatialCategory } from "../../backend";
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
    const definitionModelId: Id64String = DefinitionModel.insert(this.iModelDb, IModel.rootSubjectId, "Definition");
    assert.isTrue(Id64.isValid(definitionModelId));
    const physicalModelId: Id64String = PhysicalModel.insert(this.iModelDb, IModel.rootSubjectId, "Physical");
    assert.isTrue(Id64.isValid(physicalModelId));
    const documentListModelId: Id64String = DocumentListModel.insert(this.iModelDb, IModel.rootSubjectId, "Document");
    assert.isTrue(Id64.isValid(documentListModelId));
    const drawingId: Id64String = Drawing.insert(this.iModelDb, documentListModelId, "Drawing");
    assert.isTrue(Id64.isValid(drawingId));
    const modelSelectorId: Id64String = ModelSelector.insert(this.iModelDb, definitionModelId, "PhysicalModels", [physicalModelId]);
    assert.isTrue(Id64.isValid(modelSelectorId));
    const spatialCategoryId: Id64String = SpatialCategory.insert(this.iModelDb, definitionModelId, "SpatialCategory", { color: ColorDef.red });
    assert.isTrue(Id64.isValid(spatialCategoryId));
    const drawingCategoryId: Id64String = DrawingCategory.insert(this.iModelDb, definitionModelId, "DrawingCategory", new SubCategoryAppearance());
    assert.isTrue(Id64.isValid(drawingCategoryId));
    const spatialCategorySelectorId: Id64String = CategorySelector.insert(this.iModelDb, definitionModelId, "SpatialCategories", [spatialCategoryId]);
    assert.isTrue(Id64.isValid(spatialCategorySelectorId));
    const displayStyle2dId: Id64String = DisplayStyle2d.insert(this.iModelDb, definitionModelId, "DisplayStyle2d");
    assert.isTrue(Id64.isValid(displayStyle2dId));
    const displayStyle3dId: Id64String = DisplayStyle3d.insert(this.iModelDb, definitionModelId, "DisplayStyle3d");
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

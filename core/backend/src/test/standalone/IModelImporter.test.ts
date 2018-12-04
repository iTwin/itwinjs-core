/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Range2d, Range3d } from "@bentley/geometry-core";
import { CodeScopeSpec, ColorDef, GeometricElement2dProps, IModel, SubCategoryAppearance, Code } from "@bentley/imodeljs-common";
import {
  CategorySelector, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DocumentListModel, Drawing, DrawingCategory, DrawingGraphic, DrawingGraphicRepresentsElement, DrawingViewDefinition,
  IModelDb, IModelJsFs, ModelSelector, OrthographicViewDefinition, PhysicalModel, SpatialCategory, SubCategory, Subject,
} from "../../backend";
import { KnownTestLocations } from "../KnownTestLocations";

class TestImporter {
  public readonly iModelDb: IModelDb;

  public constructor() {
    const outputDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
    const outputFile: string = path.join(outputDir, "TestImporter.bim");
    if (IModelJsFs.existsSync(outputFile))
      IModelJsFs.removeSync(outputFile);
    this.iModelDb = IModelDb.createStandalone(outputFile, { rootSubject: { name: "TestImporter" } });
    assert.isTrue(IModelJsFs.existsSync(outputFile));
  }

  public import(): void {
    const codeSpecId: Id64String = this.iModelDb.codeSpecs.insert("CodeSpec", CodeScopeSpec.Type.Model);
    assert.isTrue(Id64.isValidId64(codeSpecId));
    const subjectId: Id64String = Subject.insert(this.iModelDb, IModel.rootSubjectId, "Subject", "Subject description");
    assert.isTrue(Id64.isValidId64(subjectId));
    const definitionModelId: Id64String = DefinitionModel.insert(this.iModelDb, subjectId, "Definition");
    assert.isTrue(Id64.isValidId64(definitionModelId));
    const physicalModelId: Id64String = PhysicalModel.insert(this.iModelDb, subjectId, "Physical");
    assert.isTrue(Id64.isValidId64(physicalModelId));
    const documentListModelId: Id64String = DocumentListModel.insert(this.iModelDb, subjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingId: Id64String = Drawing.insert(this.iModelDb, documentListModelId, "Drawing");
    assert.isTrue(Id64.isValidId64(drawingId));
    const modelSelectorId: Id64String = ModelSelector.insert(this.iModelDb, definitionModelId, "PhysicalModels", [physicalModelId]);
    assert.isTrue(Id64.isValidId64(modelSelectorId));
    const spatialCategoryId: Id64String = SpatialCategory.insert(this.iModelDb, definitionModelId, "SpatialCategory", { color: ColorDef.red });
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    const subCategoryId: Id64String = SubCategory.insert(this.iModelDb, spatialCategoryId, "SubCategory", { color: ColorDef.blue });
    assert.isTrue(Id64.isValidId64(subCategoryId));
    const drawingCategoryId: Id64String = DrawingCategory.insert(this.iModelDb, definitionModelId, "DrawingCategory", new SubCategoryAppearance());
    assert.isTrue(Id64.isValidId64(drawingCategoryId));
    const drawingGraphicProps: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic",
    };
    const drawingGraphicId: Id64String = this.iModelDb.elements.insertElement(drawingGraphicProps);
    assert.isTrue(Id64.isValidId64(drawingGraphicId));
    const drawingGraphicRepresentsId: Id64String = DrawingGraphicRepresentsElement.insert(this.iModelDb, drawingGraphicId, drawingId); // WIP: drawingId as targetId is bogus
    assert.isTrue(Id64.isValidId64(drawingGraphicRepresentsId));
    const spatialCategorySelectorId: Id64String = CategorySelector.insert(this.iModelDb, definitionModelId, "SpatialCategories", [spatialCategoryId]);
    assert.isTrue(Id64.isValidId64(spatialCategorySelectorId));
    const drawingCategorySelectorId: Id64String = CategorySelector.insert(this.iModelDb, definitionModelId, "DrawingCategories", [drawingCategoryId]);
    assert.isTrue(Id64.isValidId64(drawingCategorySelectorId));
    const displayStyle2dId: Id64String = DisplayStyle2d.insert(this.iModelDb, definitionModelId, "DisplayStyle2d");
    assert.isTrue(Id64.isValidId64(displayStyle2dId));
    const displayStyle3dId: Id64String = DisplayStyle3d.insert(this.iModelDb, definitionModelId, "DisplayStyle3d");
    assert.isTrue(Id64.isValidId64(displayStyle3dId));
    const viewRange = new Range3d(0, 0, 0, 100, 100, 20);
    const viewId: Id64String = OrthographicViewDefinition.insert(this.iModelDb, definitionModelId, "Orthographic View", modelSelectorId, spatialCategorySelectorId, displayStyle3dId, viewRange);
    assert.isTrue(Id64.isValidId64(viewId));
    this.iModelDb.views.setDefaultViewId(viewId);
    const drawingViewRange = new Range2d(0, 0, 100, 100);
    const drawingViewId: Id64String = DrawingViewDefinition.insert(this.iModelDb, definitionModelId, "Drawing View", drawingId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);
    assert.isTrue(Id64.isValidId64(drawingViewId));
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

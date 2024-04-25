/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, GeometricElement2dProps, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Point2d } from "@itwin/core-geometry";
import { assert } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { DefinitionContainer, DefinitionModel, DocumentListModel, Drawing, DrawingCategory, DrawingGraphic, ElementGroupsMembers, ElementOwnsChildElements, ExternalSource, ExternalSourceGroup, IModelDb, Model, PhysicalPartition, SnapshotDb, SpatialCategory, SubCategory, Subject } from "../../core-backend";
import { deleteElementSubTrees, deleteElementTree, ElementTreeBottomUp, ElementTreeWalkerScope } from "../../ElementTreeWalker";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

// Test class that collects the results of a bottom-up tree walk
class ElementTreeCollector extends ElementTreeBottomUp {
  public subModels: Id64Array = [];
  public definitionModels: Id64Array = [];
  public elements: Id64Array = [];
  public definitions: Id64Array = [];

  public constructor(iModel: IModelDb) { super(iModel); }

  public visitModel(model: Model, _scope: ElementTreeWalkerScope): void {
    if (model instanceof DefinitionModel)
      this.definitionModels.push(model.id);
    else
      this.subModels.push(model.id);
  }

  public visitElement(elementId: Id64String, scope: ElementTreeWalkerScope): void {
    if (scope.inDefinitionModel)
      this.definitions.push(elementId); // may be some other kind of InformationContentElement - that's OK.
    else
      this.elements.push(elementId);
  }

  public collect(topElement: Id64String): void {
    this.processElementTree(topElement, ElementTreeWalkerScope.createTopScope(this._iModel, topElement));
  }
}

class SelectedElementCollector extends ElementTreeCollector {
  public constructor(iModel: IModelDb, private _elementsToReport: Id64Array) { super(iModel); }
  public override shouldExploreModel(_model: Model): boolean { return true; }
  public override shouldVisitModel(_model: Model): boolean { return false; }
  public override shouldVisitElement(elementId: Id64String): boolean { return this._elementsToReport.includes(elementId); }
}

function doesElementExist(iModel: IModelDb, elementId: Id64String): boolean {
  return iModel.elements.tryGetElementProps(elementId) !== undefined;
}

function doesModelExist(iModel: IModelDb, mid: Id64String): boolean {
  return iModel.models.tryGetModelProps(mid) !== undefined;
}

function doesGroupRelationshipExist(iModel: IModelDb, source: Id64String, target: Id64String): boolean {
  return iModel.withPreparedStatement(`select count(*) from ${ElementGroupsMembers.classFullName} where sourceecinstanceid=? and targetecinstanceid=?`, (stmt) => {
    stmt.bindId(1, source);
    stmt.bindId(2, target);
    stmt.step();
    return stmt.getValue(0).getInteger() !== 0;
  });
}

describe("ElementTreeWalker", () => {
  let iModel: SnapshotDb;
  let originalEnv: any;

  let repositoryLinkId: Id64String;
  let jobSubjectId: Id64String;
  let childSubject: Id64String;
  let definitionModelId: Id64String;
  let definitionContainerId: Id64String;
  let drawingDefinitionModelId: Id64String;
  let spatialCategoryId: Id64String;
  let nestedSpatialCategoryId: Id64String;
  let drawingCategoryId: Id64String;
  let drawingSubCategory1Id: Id64String;
  let drawingSubCategory2Id: Id64String;
  let xsGroup: Id64String;
  let xsElement: Id64String;
  let documentListModelId: Id64String;
  let drawingModelId: Id64String;
  let drawingGraphicId1: Id64String;
  let physicalModelId: Id64String;
  let physicalObjectId1: Id64String;
  let physicalObjectId2: Id64String;
  let physicalObjectId3: Id64String;

  before(async () => {
    originalEnv = { ...process.env };

    IModelTestUtils.registerTestBimSchema();
  });

  after(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    // Uncomment the following two lines to debug test failures
    // Logger.initializeToConsole();
    // Logger.setLevel("core-backend.IModelDb.ElementTreeWalker", LogLevel.Trace);

    const iModelFileName = IModelTestUtils.prepareOutputFile("ElementTreeWalker", "Test.bim");
    iModel = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "ElementTreeWalker Test" } });
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await iModel.importSchemas([schemaPathname]); // will throw an exception if import fails

    /*
      [RepositoryModel]
        RepositoryLink
        Job Subject
          +- DefinitionParitition  --   [DefinitionModel]
          |                               DrawingCategory
          |                                 default SubCategory + 2 non-default SubCategories
          |                               ExternalSourceGroup
          |                                 ExternalSource child1
          +- DefinitionParitition  --   [DefinitionModel]
          |                               SpatialCategory
          |                               DefinitionContainer
          |                                   SpatialCategory
          |
          +- DocumentList         --    [DocumentListModel]
          |                               Drawing             -- [DrawingModel]
          |                                                       DrawingGraphic
          +- Child Subject
              |
              +- PhysicalPartition --   [PhysicalModel]
                                          PhysicalObject, PhysicalObject, PhysicalObject (grouped)
    */

    repositoryLinkId = IModelTestUtils.insertRepositoryLink(iModel, "test link", "foo", "bar");
    jobSubjectId = IModelTestUtils.createJobSubjectElement(iModel, "Job").insert();

    childSubject = Subject.insert(iModel, jobSubjectId, "Child Subject");

    definitionModelId = DefinitionModel.insert(iModel, jobSubjectId, "Definition");
    spatialCategoryId = SpatialCategory.insert(iModel, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    drawingDefinitionModelId = DefinitionModel.insert(iModel, jobSubjectId, "DrawingDefinition");
    drawingCategoryId = DrawingCategory.insert(iModel, drawingDefinitionModelId, "DrawingCategory", new SubCategoryAppearance());
    drawingSubCategory1Id = SubCategory.insert(iModel, drawingCategoryId, "SubCategory1", new SubCategoryAppearance());
    drawingSubCategory2Id = SubCategory.insert(iModel, drawingCategoryId, "SubCategory2", new SubCategoryAppearance());

    definitionContainerId = DefinitionContainer.insert(iModel, definitionModelId, Code.createEmpty());
    nestedSpatialCategoryId = SpatialCategory.insert(iModel, definitionContainerId, "nested", {});

    xsGroup = iModel.elements.insertElement({ classFullName: ExternalSourceGroup.classFullName, model: drawingDefinitionModelId, code: Code.createEmpty() });
    xsElement = iModel.elements.insertElement({ classFullName: ExternalSource.classFullName, model: drawingDefinitionModelId, parent: new ElementOwnsChildElements(xsGroup), code: Code.createEmpty() });

    documentListModelId = DocumentListModel.insert(iModel, jobSubjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    drawingModelId = Drawing.insert(iModel, documentListModelId, "Drawing");
    const drawingGraphicProps1: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic1",
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    drawingGraphicId1 = iModel.elements.insertElement(drawingGraphicProps1);

    [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(iModel, PhysicalPartition.createCode(iModel, childSubject, "Physical"), false, childSubject);
    const elementProps: GeometricElementProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };
    const elementProps2: GeometricElementProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model: physicalModelId,
      category: nestedSpatialCategoryId,
      code: Code.createEmpty(),
    };
    physicalObjectId1 = iModel.elements.insertElement(iModel.elements.createElement(elementProps).toJSON());
    physicalObjectId2 = iModel.elements.insertElement(iModel.elements.createElement(elementProps2).toJSON());
    physicalObjectId3 = iModel.elements.insertElement(iModel.elements.createElement(elementProps).toJSON());
    ElementGroupsMembers.create(iModel, physicalObjectId1, physicalObjectId2).insert();
    ElementGroupsMembers.create(iModel, physicalObjectId1, physicalObjectId3).insert();

    assert.isTrue(doesElementExist(iModel, repositoryLinkId));
    assert.equal(iModel.elements.getElement(jobSubjectId).parent?.id, IModel.rootSubjectId);
    assert.equal(iModel.elements.getElement(definitionModelId).parent?.id, jobSubjectId);
    assert.equal(iModel.elements.getElement(definitionContainerId).model, definitionModelId);
    assert.equal(iModel.elements.getElement(spatialCategoryId).model, definitionModelId);
    assert.equal(iModel.elements.getElement(nestedSpatialCategoryId).model, definitionContainerId);
    assert.equal(iModel.elements.getElement(drawingDefinitionModelId).parent?.id, jobSubjectId);
    assert.equal(iModel.elements.getElement(drawingCategoryId).model, drawingDefinitionModelId);
    assert.equal(iModel.elements.getElement(drawingSubCategory1Id).parent?.id, drawingCategoryId);
    assert.equal(iModel.elements.getElement(drawingSubCategory2Id).parent?.id, drawingCategoryId);
    assert.equal(iModel.elements.getElement(xsGroup).model, drawingDefinitionModelId);
    assert.equal(iModel.elements.getElement(xsElement).parent?.id, xsGroup);
    assert.equal(iModel.elements.getElement(documentListModelId).parent?.id, jobSubjectId);
    assert.equal(iModel.elements.getElement(drawingModelId).model, documentListModelId);
    assert.equal(iModel.elements.getElement(drawingGraphicId1).model, drawingModelId);
    assert.equal(iModel.elements.getElement(physicalModelId).parent?.id, childSubject);
    assert.equal(iModel.elements.getElement(physicalObjectId1).model, physicalModelId);
    assert.equal(iModel.elements.getElement(physicalObjectId2).model, physicalModelId);
    assert.equal(iModel.elements.getElement(physicalObjectId3).model, physicalModelId);
    assert.isTrue(doesGroupRelationshipExist(iModel, physicalObjectId1, physicalObjectId2));
    assert.isTrue(doesGroupRelationshipExist(iModel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesModelExist(iModel, definitionModelId));
    assert.isTrue(doesModelExist(iModel, definitionContainerId));
    assert.isTrue(doesModelExist(iModel, drawingDefinitionModelId));
    assert.isTrue(doesModelExist(iModel, drawingModelId));
    assert.isTrue(doesModelExist(iModel, physicalModelId));
  });

  afterEach(() => {
    sinon.restore();
    iModel.close();
  });

  it("DFS search and deleteElementTree", () => {
    // First, check that DFS search visits elements and models in expected bottom-up order
    {
      const collector1 = new ElementTreeCollector(iModel);
      collector1.collect(jobSubjectId);
      assert.isTrue(collector1.subModels.includes(physicalModelId));
      assert.isTrue(collector1.subModels.includes(drawingModelId));
      assert.isTrue(collector1.subModels.includes(documentListModelId));
      assert.isTrue(collector1.subModels.indexOf(drawingModelId) < collector1.subModels.indexOf(documentListModelId), "in bottom-up search, a child model should be visited before its parent model");
      assert.isFalse(collector1.subModels.includes(definitionModelId));
      assert.isTrue(collector1.definitionModels.includes(definitionModelId));
      assert.isFalse(collector1.subModels.includes(definitionContainerId));
      assert.isTrue(collector1.definitionModels.includes(definitionContainerId));
      assert.isFalse(collector1.subModels.includes(drawingDefinitionModelId));
      assert.isTrue(collector1.definitionModels.includes(drawingDefinitionModelId));
      assert.isTrue(collector1.definitions.includes(drawingCategoryId));
      assert.isTrue(collector1.definitions.includes(spatialCategoryId));
      assert.isTrue(collector1.definitions.includes(nestedSpatialCategoryId));
      assert.isFalse(collector1.elements.includes(drawingCategoryId));
      assert.isFalse(collector1.elements.includes(spatialCategoryId));
      assert.isFalse(collector1.elements.includes(nestedSpatialCategoryId));
      assert.isTrue(collector1.elements.indexOf(physicalObjectId1) < collector1.elements.indexOf(physicalModelId), "in bottom-up search, an element in a model should be visited before its model's element");
      assert.isTrue(collector1.elements.indexOf(drawingGraphicId1) < collector1.elements.indexOf(drawingModelId), "in bottom-up search, an element in a model should be visited before its model's element");
      assert.isTrue(collector1.elements.indexOf(drawingModelId) < collector1.elements.indexOf(documentListModelId), "in bottom-up search, an element in a model should be visited before its model's element");
      assert.isTrue(collector1.elements.indexOf(documentListModelId) < collector1.elements.indexOf(jobSubjectId), "in bottom-up search, a child element should be visited before its parent element");
      assert.isTrue(collector1.elements.indexOf(definitionModelId) < collector1.elements.indexOf(jobSubjectId), "in bottom-up search, a child element should be visited before its parent element");
      assert.isTrue(collector1.elements.indexOf(definitionContainerId) < collector1.elements.indexOf(definitionModelId), "in bottom-up search, a child element should be visited before its parent element");
      assert.isTrue(collector1.elements.indexOf(drawingDefinitionModelId) < collector1.elements.indexOf(jobSubjectId), "in bottom-up search, a child element should be visited before its parent element");
      assert.isTrue(collector1.elements.indexOf(childSubject) < collector1.elements.indexOf(jobSubjectId), "in bottom-up search, a child element should be visited before its parent element");
      assert.isTrue(collector1.elements.indexOf(physicalModelId) < collector1.elements.indexOf(childSubject), "in bottom-up search, a child element should be visited before its parent element");
    }

    // Exercise the search filters
    {
      const collector2 = new SelectedElementCollector(iModel, [drawingGraphicId1, spatialCategoryId, nestedSpatialCategoryId, physicalObjectId3]);
      collector2.collect(jobSubjectId);
      assert.isTrue(collector2.definitions.length === 2);
      assert.isTrue(collector2.definitions.includes(spatialCategoryId));
      assert.isTrue(collector2.definitions.includes(nestedSpatialCategoryId));
      assert.isTrue(collector2.elements.length === 2);
      assert.isTrue(collector2.elements.includes(drawingGraphicId1));
      assert.isTrue(collector2.elements.includes(physicalObjectId3));
    }

    // Test the deleteElementTree function
    deleteElementTree(iModel, jobSubjectId);

    assert.isTrue(doesModelExist(iModel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(iModel, IModel.dictionaryId));
    assert.isTrue(doesElementExist(iModel, repositoryLinkId), "RepositoryLink should not have been deleted, since it is not under Job Subject");
    assert.isFalse(doesElementExist(iModel, definitionModelId));
    assert.isFalse(doesElementExist(iModel, definitionContainerId));
    assert.isFalse(doesElementExist(iModel, drawingDefinitionModelId));
    assert.isFalse(doesElementExist(iModel, spatialCategoryId));
    assert.isFalse(doesElementExist(iModel, nestedSpatialCategoryId));
    assert.isFalse(doesElementExist(iModel, drawingCategoryId));
    assert.isFalse(doesElementExist(iModel, xsGroup));
    assert.isFalse(doesElementExist(iModel, xsElement));
    assert.isFalse(doesElementExist(iModel, documentListModelId));
    assert.isFalse(doesElementExist(iModel, drawingModelId));
    assert.isFalse(doesElementExist(iModel, drawingGraphicId1));
    assert.isFalse(doesElementExist(iModel, physicalModelId));
    assert.isFalse(doesElementExist(iModel, physicalObjectId1));
    assert.isFalse(doesElementExist(iModel, physicalObjectId2));
    assert.isFalse(doesElementExist(iModel, physicalObjectId3));
    assert.isFalse(doesGroupRelationshipExist(iModel, physicalObjectId1, physicalObjectId2));
    assert.isFalse(doesGroupRelationshipExist(iModel, physicalObjectId1, physicalObjectId3));
    assert.isFalse(doesElementExist(iModel, jobSubjectId));
    assert.isFalse(doesModelExist(iModel, definitionModelId));
    assert.isFalse(doesModelExist(iModel, drawingDefinitionModelId));
    assert.isFalse(doesModelExist(iModel, drawingModelId));
    assert.isFalse(doesModelExist(iModel, physicalModelId));
  });

  it("deleteElementSubTrees", () => {
    /*
      [RepositoryModel]
        RepositoryLink
        Job Subject
          +- DefinitionParitition  --   [DefinitionModel]
          |                               DrawingCategory                         <-- PRUNE
          |                                 default SubCategory + 2 non-default SubCategories
          |                               ExternalSourceGroup
          |                                 ExternalSource child1
          +- DefinitionParitition  --   [DefinitionModel]
          |                               SpatialCategory
          |                               DefinitionContainer
          |                                   SpatialCategory
          |
          +- DocumentList         --    [DocumentListModel]
          |                               Drawing             -- [DrawingModel]   <-- PRUNE
          |                                                       DrawingGraphic       "
          +- Child Subject
              |
              +- PhysicalPartition --   [PhysicalModel]
                                          PhysicalObject, PhysicalObject, PhysicalObject (grouped)
                                                                                  ^-- PRUNE
    */

    const toPrune = new Set<string>();
    toPrune.add(drawingModelId);
    toPrune.add(drawingCategoryId);
    toPrune.add(physicalObjectId3);

    deleteElementSubTrees(iModel, jobSubjectId, (elementId) => toPrune.has(elementId));

    assert.isFalse(doesElementExist(iModel, drawingCategoryId));
    assert.isFalse(doesElementExist(iModel, drawingSubCategory1Id));
    assert.isFalse(doesElementExist(iModel, drawingSubCategory2Id));
    assert.isFalse(doesElementExist(iModel, drawingModelId));
    assert.isFalse(doesModelExist(iModel, drawingModelId));
    assert.isFalse(doesElementExist(iModel, drawingGraphicId1)); // contents of drawing model should be gone
    assert.isFalse(doesElementExist(iModel, physicalObjectId3));
    assert.isFalse(doesGroupRelationshipExist(iModel, physicalObjectId1, physicalObjectId3));

    assert.isTrue(doesElementExist(iModel, repositoryLinkId));
    assert.isTrue(doesElementExist(iModel, definitionModelId));
    assert.isTrue(doesElementExist(iModel, definitionContainerId));
    assert.isTrue(doesElementExist(iModel, drawingDefinitionModelId));
    assert.equal(iModel.elements.getElement(xsGroup).model, drawingDefinitionModelId);
    assert.equal(iModel.elements.getElement(xsElement).parent?.id, xsGroup);
    assert.isTrue(doesElementExist(iModel, spatialCategoryId));
    assert.isTrue(doesElementExist(iModel, nestedSpatialCategoryId));
    assert.isTrue(doesElementExist(iModel, documentListModelId));
    assert.isTrue(doesElementExist(iModel, physicalModelId));
    assert.isTrue(doesElementExist(iModel, physicalObjectId1));
    assert.isTrue(doesElementExist(iModel, physicalObjectId2));
    assert.isTrue(doesGroupRelationshipExist(iModel, physicalObjectId1, physicalObjectId2));
    assert.isTrue(doesElementExist(iModel, jobSubjectId));
    assert.isTrue(doesModelExist(iModel, definitionModelId));
    assert.isTrue(doesModelExist(iModel, definitionContainerId));
    assert.isTrue(doesModelExist(iModel, drawingDefinitionModelId));
    assert.isTrue(doesModelExist(iModel, physicalModelId));
    assert.isTrue(doesModelExist(iModel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(iModel, IModel.dictionaryId));
  });

  it("deleteDefinitionPartition", () => {
    /*
      [RepositoryModel]
        RepositoryLink
        Job Subject
          +- DefinitionParitition  --   [DefinitionModel]                         <-- PRUNE
          |                               DrawingCategory
          |                                 default SubCategory + 2 non-default SubCategories
          |                               ExternalSourceGroup
          |                                 ExternalSource child1
          +- DefinitionParitition  --   [DefinitionModel]
          |                               SpatialCategory
          |                               DefinitionContainer
          |                                   SpatialCategory          |
          +- DocumentList         --    [DocumentListModel]
          |                               Drawing             -- [DrawingModel]
          |                                                       DrawingGraphic
          +- Child Subject
              |
              +- PhysicalPartition --   [PhysicalModel]
                                          PhysicalObject, PhysicalObject, PhysicalObject (grouped)
    */

    const toPrune = new Set<string>();
    toPrune.add(drawingDefinitionModelId);
    toPrune.add(documentListModelId); // (also get rid of the elements that use the definitions)

    deleteElementSubTrees(iModel, jobSubjectId, (elementId) => toPrune.has(elementId));

    assert.isFalse(doesElementExist(iModel, drawingDefinitionModelId));
    assert.isFalse(doesModelExist(iModel, drawingDefinitionModelId));
    assert.isFalse(doesElementExist(iModel, drawingCategoryId));
    assert.isFalse(doesElementExist(iModel, drawingSubCategory1Id));
    assert.isFalse(doesElementExist(iModel, drawingSubCategory2Id));
    assert.isFalse(doesElementExist(iModel, xsGroup));
    assert.isFalse(doesElementExist(iModel, xsElement));
    assert.isFalse(doesElementExist(iModel, documentListModelId));
    assert.isFalse(doesModelExist(iModel, documentListModelId));
    assert.isFalse(doesElementExist(iModel, drawingModelId));
    assert.isFalse(doesModelExist(iModel, drawingModelId));
    assert.isFalse(doesElementExist(iModel, drawingGraphicId1));

    assert.isTrue(doesElementExist(iModel, repositoryLinkId));
    assert.isTrue(doesElementExist(iModel, definitionModelId));
    assert.isTrue(doesElementExist(iModel, definitionContainerId));
    assert.isTrue(doesElementExist(iModel, spatialCategoryId));
    assert.isTrue(doesElementExist(iModel, nestedSpatialCategoryId));
    assert.isTrue(doesElementExist(iModel, physicalModelId));
    assert.isTrue(doesElementExist(iModel, physicalObjectId1));
    assert.isTrue(doesElementExist(iModel, physicalObjectId2));
    assert.isTrue(doesElementExist(iModel, physicalObjectId3));
    assert.isTrue(doesGroupRelationshipExist(iModel, physicalObjectId1, physicalObjectId2));
    assert.isTrue(doesGroupRelationshipExist(iModel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesElementExist(iModel, jobSubjectId));
    assert.isTrue(doesModelExist(iModel, definitionModelId));
    assert.isTrue(doesModelExist(iModel, definitionContainerId));
    assert.isTrue(doesModelExist(iModel, physicalModelId));
    assert.isTrue(doesModelExist(iModel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(iModel, IModel.dictionaryId));
  });
});

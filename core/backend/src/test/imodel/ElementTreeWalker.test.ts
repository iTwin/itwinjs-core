/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { assert as beAssert, DbResult, Id64, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import {
  Code, GeometricElement2dProps, GeometricElementProps, IModel, IModelError, IModelStatus, SubCategoryAppearance,
} from "@itwin/core-common";
import {
  Point2d,
} from "@itwin/core-geometry";
import {
  DefinitionElement, DefinitionModel,
  DocumentListModel, Drawing, DrawingCategory, DrawingGraphic, ElementGroupsMembers, IModelDb, Model, PhysicalPartition, SnapshotDb, SpatialCategory, Subject,
} from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelTestUtils } from "../IModelTestUtils";

// spell-checker: disable

interface ElementTreeWalkerModelInfo { model: Model, isDefn: boolean }

function isDefinitionModel(model: Model): boolean {
  return (model.id !== IModel.repositoryModelId) && (model instanceof DefinitionModel);
}

function isDefinitionElement(imodel: IModelDb, elid: Id64String): boolean {
  const el = imodel.elements.getElement(elid);
  return el instanceof DefinitionElement;
}

function isSubjectElement(imodel: IModelDb, elid: Id64String): boolean {
  const el = imodel.elements.getElement(elid);
  return el instanceof Subject;
}

enum ElementPruningClassification { PRUNING_CLASS_Normal = 0, PRUNING_CLASS_Subject = 1, PRUNING_CLASS_Definition = 2, }

function classifyElementForPruning(imodel: IModelDb, elid: Id64String): ElementPruningClassification {
  const el = imodel.elements.getElement(elid);
  return (el instanceof Subject) ? ElementPruningClassification.PRUNING_CLASS_Subject :
    (el instanceof DefinitionElement) ? ElementPruningClassification.PRUNING_CLASS_Definition :
      ElementPruningClassification.PRUNING_CLASS_Normal;
}

/** Describes how an element or model was reached. This object is immutable. */
class ElementTreeWalkerScope {
  public readonly topElement: Id64String = "";
  /** path of parent elements and enclosing models */
  public readonly path: Array<Id64String | ElementTreeWalkerModelInfo> = [];
  /** cached info about the immediately enclosing model (i.e., the last model in path) */
  public readonly enclosingModelInfo: ElementTreeWalkerModelInfo;

  constructor(topElement: Id64String, model: Model);
  constructor(enclosingScope: ElementTreeWalkerScope, newScope: Id64String | Model);
  constructor(arg1: Id64String | ElementTreeWalkerScope, arg2: Model | Id64String) {
    if (typeof arg1 === "string") {
      // normal constructor
      beAssert(arg2 instanceof Model);
      this.topElement = arg1;
      this.path.push(this.enclosingModelInfo = { model: arg2, isDefn: isDefinitionModel(arg2) });
    } else if (arg1 instanceof ElementTreeWalkerScope) {
      // copy-like constructor
      beAssert(this.topElement !== "", "must call normal constructor first");
      this.path = [...arg1.path];
      if (typeof arg2 === "string") {
        // with new parent
        this.path.push(arg2);
        this.enclosingModelInfo = arg1.enclosingModelInfo;
      } else {
        // with new enclosing model
        this.path.push(this.enclosingModelInfo = { model: arg2, isDefn: isDefinitionModel(arg2) });
      }
    } else {
      throw new Error("invalid constructor signature");
    }
  }

  public get enclosingModel(): Model { return this.enclosingModelInfo.model; }
  public get inDefinitionModel(): boolean { return this.enclosingModelInfo.isDefn; } // NB: this will return false for the RepositoryModel!
  public get inRepositoryModel(): boolean { return this.enclosingModelInfo.model.id === IModelDb.repositoryModelId; }

  public static createTopScope(imodel: IModelDb, topElementId: Id64String) {
    const topElement = imodel.elements.getElement(topElementId);
    const topElementModel = imodel.models.getModel(topElement.model);
    return new ElementTreeWalkerScope(topElementId, topElementModel);
  }

  private fmtItem(v: Id64String | ElementTreeWalkerModelInfo): string {
    if (typeof v === "string")
      return `element ${v}`;
    return `model ${v.model.id} ${v.isDefn ? "(DEFN)" : ""}`;
  }

  public toString(): string {
    return `[ ${this.path.map((v) => this.fmtItem(v)).join(", ")} ]`;
  }
}

/** Does a depth-first search on the tree defined by an element and its submodels and children.
 * Sub-models are visited before their modeled elements, and children are visited before their parents.
 *
 * The following callbacks allow the subclass to exclude elements and sub-trees from the search:
 *  * [[ElementTreeBottomUp.shouldExploreModel]], [[ElementTreeBottomUp.shouldExploreChildren]]
 *  * [[ElementTreeBottomUp.shouldVisitElement]], [[ElementTreeBottomUp.shouldVisitModel]]
 *
 * The [[ElementTreeBottomUp.visitElement]] and [[ElementTreeBottomUp.visitModel]] callbacks allow
 * the subclass to process the elements and models that are encountered in the search.
 */
abstract class ElementTreeBottomUp {
  constructor(protected _imodel: IModelDb) { }

  /** Return true if the search should recurse into this model  */
  public shouldExploreModel(_model: Model, _scope: ElementTreeWalkerScope): boolean { return true; }
  /** Return true if the search should recurse into the children (if any) of this element  */
  public shouldExploreChildren(_parentId: Id64String, _scope: ElementTreeWalkerScope): boolean { return true; }
  /** Return true if the search should visit this element  */
  public shouldVisitElement(_elid: Id64String, _scope: ElementTreeWalkerScope): boolean { return true; }
  /** Return true if the search should visit this model  */
  public shouldVisitModel(_model: Model, _scope: ElementTreeWalkerScope): boolean { return true; }

  /** Called to visit a model */
  public abstract visitModel(model: Model, scope: ElementTreeWalkerScope): void;

  /** Called to visit an element */
  public abstract visitElement(elid: Id64String, scope: ElementTreeWalkerScope): void;

  protected processElementTree(element: Id64String, scope: ElementTreeWalkerScope) {
    const subModel = this._imodel.models.tryGetModel<Model>(element);
    if (subModel !== undefined) {
      if (this.shouldExploreModel(subModel, scope))
        this.processSubModel(subModel, scope);

      if (this.shouldVisitModel(subModel, scope))
        this.visitModel(subModel, scope);
    }

    if (this.shouldExploreChildren(element, scope))
      this.processChildren(element, scope);

    if (this.shouldVisitElement(element, scope))
      this.visitElement(element, scope);
  }

  protected processChildren(parentElement: Id64String, parentScope: ElementTreeWalkerScope): void {
    const children = this._imodel.elements.queryChildren(parentElement);
    if (children.length === 0)
      return;

    const childrenScope = new ElementTreeWalkerScope(parentScope, parentElement);

    for (const childElement of children)
      this.processElementTree(childElement, childrenScope);
  }

  protected processSubModel(model: Model, parenScope: ElementTreeWalkerScope): void {
    const scope = new ElementTreeWalkerScope(parenScope, model);

    model.iModel.withPreparedStatement(`select ECInstanceId from bis:Element where Model.id=?`, (stmt) => {
      stmt.bindId(1, model.id);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const elid = stmt.getValue(0).getId();
        this.processElementTree(elid, scope);
      }
    });
  }
}

// Test class that collects and prints the results of a bottom-up tree walk
class ElementTreeDumper extends ElementTreeBottomUp {
  private _subModels: Id64Array = [];
  private _definitionModels: Id64Array = [];
  private _elements: Id64Array = [];
  private _definitions: Id64Array = [];

  public constructor(imodel: IModelDb) { super(imodel); }

  public visitModel(model: Model, _scope: ElementTreeWalkerScope): void {
    if (isDefinitionModel(model))
      this._definitionModels.push(model.id);
    else
      this._subModels.push(model.id);
  }

  public visitElement(elid: Id64String, scope: ElementTreeWalkerScope): void {
    if (scope.inDefinitionModel)
      this._definitions.push(elid); // may be some other kind of InformationContentElement - that's OK.
    else
      this._elements.push(elid);
  }

  private dump() {
    console.log("subModels");
    for (const mid of this._subModels) {
      const m = this._imodel.models.getModelProps(mid);
      console.log(`${m.id} ${m.classFullName} ${m.name}`);
    }

    console.log("definitionModels");
    for (const mid of this._definitionModels) {
      const m = this._imodel.models.getModelProps(mid);
      console.log(`${m.id} ${m.classFullName} ${m.name}`);
    }

    console.log("elements");
    for (const eid of this._elements) {
      const e = this._imodel.elements.getElementProps(eid);
      console.log(`${e.id} ${e.classFullName} ^${e.parent?.id} ${e.code.value}`);
    }

    console.log("definitions");
    for (const eid of this._definitions) {
      const e = this._imodel.elements.getElementProps(eid);
      console.log(`${e.id} ${e.classFullName} ^${e.parent?.id} ${e.code.value}`);
    }
  }

  public report(topElement: Id64String): void {
    this.processElementTree(topElement, ElementTreeWalkerScope.createTopScope(this._imodel, topElement));
    this.dump();
  }
}

class SelectedElementReporter extends ElementTreeDumper {
  public constructor(imodel: IModelDb, private _elementsToReport: Id64Array) { super(imodel); }
  public override shouldExploreModel(_model: Model): boolean { return true; }
  public override shouldVisitModel(_model: Model): boolean { return false; }
  public override shouldVisitElement(elid: Id64String): boolean { return this._elementsToReport.includes(elid); }
}

/** Deletes an entire element tree, including sub-models and child elements. Items are deleted in
 * bottom-up order. Definitions and Subjects are deleted after "normal" elements. */
class ElementTreeDeleter extends ElementTreeBottomUp {
  private _definitionModels: Id64Array = [];
  private _definitions: Id64Array = [];
  private _subjects: Id64Array = [];

  public constructor(imodel: IModelDb) { super(imodel); }

  public override shouldExploreModel(_model: Model): boolean { return true; }
  public override shouldVisitElement(_elid: Id64String): boolean { return true; }

  // Delete the "normal" models and record the definition models for deferred processing
  public override visitModel(model: Model, _scope: ElementTreeWalkerScope): void {
    // model contents were already processed + deleted
    if (isDefinitionModel(model))
      this._definitionModels.push(model.id);
    else
      model.delete();
  }

  // Delete the "normal" elements and record the definitions and Subjects for deferred processing
  public override visitElement(elid: Id64String, scope: ElementTreeWalkerScope): void {
    if ((scope.inDefinitionModel || scope.inRepositoryModel) && isDefinitionElement(this._imodel, elid)) {
      this._definitions.push(elid);
    } else if (this._imodel.elements.tryGetElement<Subject>(elid, Subject) !== undefined) {
      this._subjects.push(elid);
    } else if (this._definitionModels.includes(elid)) {
      // this is a DefinitionPartition. We will delete it in deleteDefinitions
    } else {
      try {
        console.log(`Delete ${elid} in scope ${scope}`);
        this._imodel.elements.deleteElement(elid);
      } catch (err) {
        // we sometimes see child elements twice when traversing a model.
        if (!(err instanceof IModelError) || err.errorNumber !== IModelStatus.NotFound)
          throw err;
      }
    }
  }

  public deleteElementTree(topElement: Id64String, scope?: ElementTreeWalkerScope): void {
    // Deletes the "normal" elements and records the definitions and Subjects for deferred processing
    this.processElementTree(topElement, scope ?? ElementTreeWalkerScope.createTopScope(this._imodel, topElement));

    // Now the (unused) definitions can be deleted
    console.log(`Delete definition elements ${JSON.stringify(this._definitions)}`);
    this._imodel.elements.deleteDefinitionElements(this._definitions); // (will not delete definitions that are still in use)

    for (const m of this._definitionModels) {
      try {
        console.log(`Delete definition model ${m}`);
        this._imodel.models.deleteModel(m);
        this._imodel.elements.deleteElement(m);
      } catch (err) {
        // TODO: Check that this is because defn is still in used.
        // will fail if some of the definitions in the model could not be deleted
      }
    }

    // Finally, delete the parent Subjects. (We defer them, because some of them may be the parents
    // of child definition models, and we have to wait until we have deleted those child models.)
    for (const e of this._subjects) {
      try {
        console.log(`Delete Subject ${e}`);
        this._imodel.elements.deleteElement(e);
      } catch (err) {
        // TODO: Check that this is because defn child model still exists
        // will fail if the subject still has children, e.g., because a child definition model could not be deleted in the loop above.
      }
    }
  }

}

/** Does a breadth-first search on the tree defined by an element and its submodels and children.
 * Parents are visited first, then children, then sub-models.
 *
 * The subclass can "prune" sub-trees from the search. When a sub-tree is "pruned" the search does *not* recurse into it.
 * If a sub-tree is not pruned, then the search does recurse into it.
 */
abstract class ElementTreeTopDown {
  constructor(protected _imodel: IModelDb) { }

  /** Should the search *not* recurse into this sub-tree? */
  public shouldPrune(_elid: Id64String, _scope: ElementTreeWalkerScope): boolean { return false; }

  public abstract prune(_elid: Id64String, _scope: ElementTreeWalkerScope): void;

  protected processElementTree(element: Id64String, scope: ElementTreeWalkerScope) {

    if (this.shouldPrune(element, scope)) {
      this.prune(element, scope);
      return;
    }

    this.processChildren(element, scope);

    const subModel = this._imodel.models.tryGetModel<Model>(element);
    if (subModel !== undefined) {
      this.processSubModel(subModel, scope);
    }
  }

  private processChildren(element: Id64String, scope: ElementTreeWalkerScope) {
    let parentScope: ElementTreeWalkerScope | undefined;
    for (const childElement of this._imodel.elements.queryChildren(element)) {
      if (parentScope === undefined)
        parentScope = new ElementTreeWalkerScope(scope, element);
      this.processElementTree(childElement, parentScope);
    }
  }

  private processSubModel(subModel: Model, scope: ElementTreeWalkerScope) {
    const subModelScope = new ElementTreeWalkerScope(scope, subModel);
    this._imodel.withPreparedStatement(`select ECInstanceId from bis:Element where Model.id=?`, (stmt) => {
      stmt.bindId(1, subModel.id);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const elid = stmt.getValue(0).getId();
        this.processElementTree(elid, subModelScope);
      }
    });
  }

}

class SelectedElementSubTreeDeleter extends ElementTreeTopDown {
  private _definitions: Id64Array = [];
  private _subjects: Id64Array = [];

  constructor(imodel: IModelDb, private _elementsToPrune: Id64Set) {
    super(imodel);
  }

  public override shouldPrune(elid: Id64String, _scope: ElementTreeWalkerScope): boolean { return this._elementsToPrune.has(elid); }

  public prune(elid: Id64String, scope: ElementTreeWalkerScope): void {
    if (scope.inRepositoryModel) {
      const cls = classifyElementForPruning(this._imodel, elid);
      if (cls === ElementPruningClassification.PRUNING_CLASS_Subject) {
        this._subjects.push(elid);
        return;
      } else if (cls === ElementPruningClassification.PRUNING_CLASS_Definition) {
        this._definitions.push(elid);
        return;
      }
    } else if (scope.inDefinitionModel) {
      this._definitions.push(elid);
      return;
    }

    const del = new ElementTreeDeleter(this._imodel);
    del.deleteElementTree(elid, scope);
  }

  public pruneElementTree(top: Id64String) {
    this.processElementTree(top, ElementTreeWalkerScope.createTopScope(this._imodel, top)); // deletes normal elements and their sub-trees

    const del = new ElementTreeDeleter(this._imodel);

    for (const elid of this._definitions) // unused definitions can now be deleted
      del.deleteElementTree(elid);

    for (const elid of this._subjects) { // finally subjects can be deleted
      del.deleteElementTree(elid);
    }
  }
}

function doesElementExist(imodel: IModelDb, elid: Id64String): boolean {
  return imodel.elements.tryGetElementProps(elid) !== undefined;
}

function doesModelExist(imodel: IModelDb, mid: Id64String): boolean {
  return imodel.models.tryGetModelProps(mid) !== undefined;
}

function doesGroupRelationshipExist(imodel: IModelDb, source: Id64String, target: Id64String): boolean {
  return imodel.withPreparedStatement(`select count(*) from ${ElementGroupsMembers.classFullName} where sourceecinstanceid=? and targetecinstanceid=?`, (stmt) => {
    stmt.bindId(1, source);
    stmt.bindId(2, target);
    stmt.step();
    return stmt.getValue(0).getInteger() !== 0;
  });
}

describe.only("ElementTreeWalker", () => {
  let imodel1: SnapshotDb;
  let originalEnv: any;

  before(async () => {
    originalEnv = { ...process.env };

    IModelTestUtils.registerTestBimSchema();
  });

  after(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    imodel1 = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel1.importSchemas([schemaPathname]); // will throw an exception if import fails
  });

  afterEach(() => {
    sinon.restore();
    imodel1.close();
  });

  it("delete element tree with nested models", () => {

    const testImodel = imodel1;

    /*
      [RepositoryModel]
        RepositoryLink
        Job Subject
          +- DefinitionParitition  --   [DefinitionModel]
          |                               DrawingCategory
          |                               SpatialCategory
          |
          +- DocumentList         --    [DocumentListModel]
          |                               Drawing             -- [DrawingModel]
          |                                                       DrawingGraphic
          +- Child Subject
              |
              +- PhysicalPartition --   [PhysicalModel]
                                          PhysicalObject, PhysicalObject, PhysicalObject (grouped)
    */

    const repositoryLinkId = IModelTestUtils.insertRepositoryLink(testImodel, "test link", "foo", "bar");
    const jobSubjectId = IModelTestUtils.createJobSubjectElement(testImodel, "Job").insert();

    const childSubject = Subject.insert(testImodel, jobSubjectId, "Child Subject");

    const definitionModelId = DefinitionModel.insert(testImodel, jobSubjectId, "Definition");
    const spatialCategoryId = SpatialCategory.insert(testImodel, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    const drawingCategoryId = DrawingCategory.insert(testImodel, definitionModelId, "DrawingCategory", new SubCategoryAppearance());

    const documentListModelId = DocumentListModel.insert(testImodel, jobSubjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingModelId = Drawing.insert(testImodel, documentListModelId, "Drawing");
    const drawingGraphicProps1: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic1",
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    const drawingGraphicId1 = testImodel.elements.insertElement(drawingGraphicProps1);

    const [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testImodel, PhysicalPartition.createCode(testImodel, childSubject, "Physical"), false, childSubject);
    const elementProps: GeometricElementProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    const physicalObjectId1 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    const physicalObjectId2 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    const physicalObjectId3 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    ElementGroupsMembers.create(testImodel, physicalObjectId1, physicalObjectId2).insert();
    ElementGroupsMembers.create(testImodel, physicalObjectId1, physicalObjectId3).insert();

    assert.isTrue(doesElementExist(testImodel, repositoryLinkId));
    assert.equal(testImodel.elements.getElement(jobSubjectId).parent?.id, IModel.rootSubjectId);
    assert.equal(testImodel.elements.getElement(definitionModelId).parent?.id, jobSubjectId);
    assert.equal(testImodel.elements.getElement(spatialCategoryId).model, definitionModelId);
    assert.equal(testImodel.elements.getElement(drawingCategoryId).model, definitionModelId);
    assert.equal(testImodel.elements.getElement(documentListModelId).parent?.id, jobSubjectId);
    assert.equal(testImodel.elements.getElement(drawingModelId).model, documentListModelId);
    assert.equal(testImodel.elements.getElement(drawingGraphicId1).model, drawingModelId);
    assert.equal(testImodel.elements.getElement(physicalModelId).parent?.id, childSubject);
    assert.equal(testImodel.elements.getElement(physicalObjectId1).model, physicalModelId);
    assert.equal(testImodel.elements.getElement(physicalObjectId2).model, physicalModelId);
    assert.equal(testImodel.elements.getElement(physicalObjectId3).model, physicalModelId);
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId2));
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesModelExist(testImodel, definitionModelId));
    assert.isTrue(doesModelExist(testImodel, drawingModelId));
    assert.isTrue(doesModelExist(testImodel, physicalModelId));

    console.log("The tree of elements and submodels");
    const del1 = new ElementTreeDumper(testImodel);
    del1.report(jobSubjectId);

    console.log("Selected individual elements down in the models");
    const del2 = new SelectedElementReporter(testImodel, [drawingGraphicId1, spatialCategoryId, physicalObjectId3]);
    del2.report(jobSubjectId);

    const del3 = new ElementTreeDeleter(testImodel);
    del3.deleteElementTree(jobSubjectId);

    assert.isTrue(doesElementExist(testImodel, repositoryLinkId), "RepositoryLink should not have been deleted, since it is not under Job Subject");
    assert.isFalse(doesElementExist(testImodel, definitionModelId));
    assert.isFalse(doesElementExist(testImodel, spatialCategoryId));
    assert.isFalse(doesElementExist(testImodel, drawingCategoryId));
    assert.isFalse(doesElementExist(testImodel, documentListModelId));
    assert.isFalse(doesElementExist(testImodel, drawingModelId));
    assert.isFalse(doesElementExist(testImodel, drawingGraphicId1));
    assert.isFalse(doesElementExist(testImodel, physicalModelId));
    assert.isFalse(doesElementExist(testImodel, physicalObjectId1));
    assert.isFalse(doesElementExist(testImodel, physicalObjectId2));
    assert.isFalse(doesElementExist(testImodel, physicalObjectId3));
    assert.isFalse(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId2));
    assert.isFalse(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId3));
    assert.isFalse(doesElementExist(testImodel, jobSubjectId));
    assert.isFalse(doesModelExist(testImodel, definitionModelId));
    assert.isFalse(doesModelExist(testImodel, drawingModelId));
    assert.isFalse(doesModelExist(testImodel, physicalModelId));
    assert.isTrue(doesModelExist(testImodel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(testImodel, IModel.dictionaryId));
  });

  it("delete element sub-tree with nested models", () => {

    const testImodel = imodel1;

    /*
      [RepositoryModel]
        RepositoryLink
        Job Subject
          +- DefinitionParitition  --   [DefinitionModel]
          |                               DrawingCategory
          |                               SpatialCategory
          |
          +- DocumentList         --    [DocumentListModel]
          |                               Drawing             -- [DrawingModel]
          |                                                       DrawingGraphic
          +- Child Subject
              |
              +- PhysicalPartition --   [PhysicalModel]
                                          PhysicalObject, PhysicalObject, PhysicalObject (grouped)
    */

    const repositoryLinkId = IModelTestUtils.insertRepositoryLink(testImodel, "test link", "foo", "bar");
    const jobSubjectId = IModelTestUtils.createJobSubjectElement(testImodel, "Job").insert();

    const childSubject = Subject.insert(testImodel, jobSubjectId, "Child Subject");

    const definitionModelId = DefinitionModel.insert(testImodel, jobSubjectId, "Definition");
    const spatialCategoryId = SpatialCategory.insert(testImodel, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    const drawingCategoryId = DrawingCategory.insert(testImodel, definitionModelId, "DrawingCategory", new SubCategoryAppearance());

    const documentListModelId = DocumentListModel.insert(testImodel, jobSubjectId, "Document");
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingModelId = Drawing.insert(testImodel, documentListModelId, "Drawing");
    const drawingGraphicProps1: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic1",
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    const drawingGraphicId1 = testImodel.elements.insertElement(drawingGraphicProps1);

    const [, physicalModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testImodel, PhysicalPartition.createCode(testImodel, childSubject, "Physical"), false, childSubject);
    const elementProps: GeometricElementProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    const physicalObjectId1 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    const physicalObjectId2 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    const physicalObjectId3 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
    ElementGroupsMembers.create(testImodel, physicalObjectId1, physicalObjectId2).insert();
    ElementGroupsMembers.create(testImodel, physicalObjectId1, physicalObjectId3).insert();

    assert.isTrue(doesElementExist(testImodel, repositoryLinkId));
    assert.equal(testImodel.elements.getElement(jobSubjectId).parent?.id, IModel.rootSubjectId);
    assert.equal(testImodel.elements.getElement(definitionModelId).parent?.id, jobSubjectId);
    assert.equal(testImodel.elements.getElement(spatialCategoryId).model, definitionModelId);
    assert.equal(testImodel.elements.getElement(drawingCategoryId).model, definitionModelId);
    assert.equal(testImodel.elements.getElement(documentListModelId).parent?.id, jobSubjectId);
    assert.equal(testImodel.elements.getElement(drawingModelId).model, documentListModelId);
    assert.equal(testImodel.elements.getElement(drawingGraphicId1).model, drawingModelId);
    assert.equal(testImodel.elements.getElement(physicalModelId).parent?.id, childSubject);
    assert.equal(testImodel.elements.getElement(physicalObjectId1).model, physicalModelId);
    assert.equal(testImodel.elements.getElement(physicalObjectId2).model, physicalModelId);
    assert.equal(testImodel.elements.getElement(physicalObjectId3).model, physicalModelId);
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId2));
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesModelExist(testImodel, definitionModelId));
    assert.isTrue(doesModelExist(testImodel, drawingModelId));
    assert.isTrue(doesModelExist(testImodel, physicalModelId));

    const toPrune = new Set<string>();
    toPrune.add(drawingModelId);
    toPrune.add(drawingCategoryId);
    toPrune.add(physicalObjectId3);
    const del3 = new SelectedElementSubTreeDeleter(testImodel, toPrune);
    del3.pruneElementTree(jobSubjectId);

    assert.isTrue(doesElementExist(testImodel, repositoryLinkId));
    assert.isTrue(doesElementExist(testImodel, definitionModelId));
    assert.isTrue(doesElementExist(testImodel, spatialCategoryId));
    assert.isFalse(doesElementExist(testImodel, drawingCategoryId));
    assert.isTrue(doesElementExist(testImodel, documentListModelId));
    assert.isFalse(doesElementExist(testImodel, drawingModelId));
    assert.isTrue(doesElementExist(testImodel, drawingGraphicId1));
    assert.isTrue(doesElementExist(testImodel, physicalModelId));
    assert.isTrue(doesElementExist(testImodel, physicalObjectId1));
    assert.isTrue(doesElementExist(testImodel, physicalObjectId2));
    assert.isFalse(doesElementExist(testImodel, physicalObjectId3));
    assert.isTrue(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId2));
    assert.isFalse(doesGroupRelationshipExist(testImodel, physicalObjectId1, physicalObjectId3));
    assert.isTrue(doesElementExist(testImodel, jobSubjectId));
    assert.isTrue(doesModelExist(testImodel, definitionModelId));
    assert.isTrue(doesModelExist(testImodel, drawingModelId));
    assert.isTrue(doesModelExist(testImodel, physicalModelId));
    assert.isTrue(doesModelExist(testImodel, IModel.repositoryModelId));
    assert.isTrue(doesModelExist(testImodel, IModel.dictionaryId));
  });
});

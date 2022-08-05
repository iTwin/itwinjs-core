/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */
import { assert, DbResult, Id64Array, Id64String } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { DefinitionElement, DefinitionPartition, Element, Subject } from "./Element";
import { IModelDb } from "./IModelDb";
import { DefinitionModel, Model } from "./Model";

interface ElementTreeWalkerModelInfo { model: Model, isDefinitionModel: boolean }

export function isModelEmpty(iModel: IModelDb, modelId: Id64String): boolean {
  return iModel.withPreparedStatement(`select count(*) from ${Element.classFullName} where Model.Id = ?`, (stmt) => {
    stmt.bindId(1, modelId);
    stmt.step();
    return stmt.getValue(0).getInteger() === 0;
  });
}

export function isDefinitionModel(model: Model): boolean {
  return (model.id !== IModel.repositoryModelId) && (model instanceof DefinitionModel);
}

export enum ElementPruningClassification { PRUNING_CLASS_Normal = 0, PRUNING_CLASS_Subject = 1, PRUNING_CLASS_Definition = 2, PRUNING_CLASS_DefinitionPartition = 3, }

export function classifyElementForPruning(iModel: IModelDb, elementId: Id64String): ElementPruningClassification {
  const el = iModel.elements.getElement(elementId);
  return (el instanceof Subject) ? ElementPruningClassification.PRUNING_CLASS_Subject :
    (el instanceof DefinitionElement) ? ElementPruningClassification.PRUNING_CLASS_Definition :
      (el instanceof DefinitionPartition) ? ElementPruningClassification.PRUNING_CLASS_DefinitionPartition :
        ElementPruningClassification.PRUNING_CLASS_Normal;
}

/** Records the path that a tree search took to reach an element or model. This object is immutable.
 * @alpha
 */
export class ElementTreeWalkerScope {
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
      assert(arg2 instanceof Model);
      this.topElement = arg1;
      this.path.push(this.enclosingModelInfo = { model: arg2, isDefinitionModel: isDefinitionModel(arg2) });
    } else if (arg1 instanceof ElementTreeWalkerScope) {
      // copy-like constructor
      assert(this.topElement !== "", "must call normal constructor first");
      this.path = [...arg1.path];
      if (typeof arg2 === "string") {
        // with new parent
        this.path.push(arg2);
        this.enclosingModelInfo = arg1.enclosingModelInfo;
      } else {
        // with new enclosing model
        this.path.push(this.enclosingModelInfo = { model: arg2, isDefinitionModel: isDefinitionModel(arg2) });
      }
    } else {
      throw new Error("invalid constructor signature");
    }
  }

  public get enclosingModel(): Model { return this.enclosingModelInfo.model; }
  public get inDefinitionModel(): boolean { return this.enclosingModelInfo.isDefinitionModel; } // NB: this will return false for the RepositoryModel!
  public get inRepositoryModel(): boolean { return this.enclosingModelInfo.model.id === IModelDb.repositoryModelId; }

  public static createTopScope(iModel: IModelDb, topElementId: Id64String) {
    const topElement = iModel.elements.getElement(topElementId);
    const topElementModel = iModel.models.getModel(topElement.model);
    return new ElementTreeWalkerScope(topElementId, topElementModel);
  }
}

/** Does a depth-first search on the tree defined by an element and its sub-models and children.
 * Sub-models are visited before their modeled elements, and children are visited before their parents.
 *
 * The following callbacks allow the subclass to exclude elements and sub-trees from the search:
 *  * [[ElementTreeBottomUp.shouldExploreModel]], [[ElementTreeBottomUp.shouldExploreChildren]]
 *  * [[ElementTreeBottomUp.shouldVisitElement]], [[ElementTreeBottomUp.shouldVisitModel]]
 *
 * The [[ElementTreeBottomUp.visitElement]] and [[ElementTreeBottomUp.visitModel]] callbacks allow
 * the subclass to process the elements and models that are encountered in the search.
 * @alpha
 */
export abstract class ElementTreeBottomUp {
  constructor(protected _iModel: IModelDb) { }

  /** Return true if the search should recurse into this model  */
  protected shouldExploreModel(_model: Model, _scope: ElementTreeWalkerScope): boolean { return true; }
  /** Return true if the search should recurse into the children (if any) of this element  */
  protected shouldExploreChildren(_parentId: Id64String, _scope: ElementTreeWalkerScope): boolean { return true; }
  /** Return true if the search should visit this element  */
  protected shouldVisitElement(_elementId: Id64String, _scope: ElementTreeWalkerScope): boolean { return true; }
  /** Return true if the search should visit this model  */
  protected shouldVisitModel(_model: Model, _scope: ElementTreeWalkerScope): boolean { return true; }

  /** Called to visit a model */
  protected abstract visitModel(model: Model, scope: ElementTreeWalkerScope): void;

  /** Called to visit an element */
  protected abstract visitElement(elementId: Id64String, scope: ElementTreeWalkerScope): void;

  /** The main tree-walking function */
  protected processElementTree(element: Id64String, scope: ElementTreeWalkerScope) {
    const subModel = this._iModel.models.tryGetModel<Model>(element);
    if (subModel !== undefined) {
      if (this.shouldExploreModel(subModel, scope))
        this._processSubModel(subModel, scope);

      if (this.shouldVisitModel(subModel, scope))
        this.visitModel(subModel, scope);
    }

    if (this.shouldExploreChildren(element, scope))
      this._processChildren(element, scope);

    if (this.shouldVisitElement(element, scope))
      this.visitElement(element, scope);
  }

  /** process the children of the specified parent element */
  private _processChildren(parentElement: Id64String, parentScope: ElementTreeWalkerScope): void {
    const children = this._iModel.elements.queryChildren(parentElement);
    if (children.length === 0)
      return;

    const childrenScope = new ElementTreeWalkerScope(parentScope, parentElement);

    for (const childElement of children)
      this.processElementTree(childElement, childrenScope);
  }

  /** process the elements in the specified model */
  private _processSubModel(model: Model, parenScope: ElementTreeWalkerScope): void {
    const scope = new ElementTreeWalkerScope(parenScope, model);
    // Visit only the top-level parents. processElementTree will visit their children (bottom-up).
    model.iModel.withPreparedStatement(`select ECInstanceId from bis:Element where Model.id=? and Parent.Id is null`, (stmt) => {
      stmt.bindId(1, model.id);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const elementId = stmt.getValue(0).getId();
        this.processElementTree(elementId, scope);
      }
    });
  }
}

/** Helper class that manages the deletion of definitions and subjects */
class SpecialElements {
  public definitionModels: Id64Array = [];
  public definitions: Id64Array = [];
  public subjects: Id64Array = [];

  public recordSpecialElement(iModel: IModelDb, elementId: Id64String): boolean {
    // Defer Definitions and Subjects
    const cls = classifyElementForPruning(iModel, elementId);
    if (cls === ElementPruningClassification.PRUNING_CLASS_Subject) {
      this.subjects.push(elementId);
      return true;
    } else if (cls === ElementPruningClassification.PRUNING_CLASS_Definition) {
      this.definitions.push(elementId);
      return true;
    } else if (cls === ElementPruningClassification.PRUNING_CLASS_DefinitionPartition) {
      this.definitionModels.push(elementId);
      return true;
    }
    return false; // not a special element
  }

  public deleteSpecialElements(iModel: IModelDb) {
    iModel.elements.deleteDefinitionElements(this.definitions); // will not deleted definitions that are still in use.

    for (const m of this.definitionModels) {
      if (!isModelEmpty(iModel, m)) // can't delete the model if one or more of the Definitions could not be deleted because still in use.
        continue;
      iModel.models.deleteModel(m);
      iModel.elements.deleteElement(m);
    }

    for (const e of this.subjects) {
      if (iModel.elements.queryChildren(e).length === 0) // can't delete the Subject if one or more of its child elements was a DefinitionPartition that could not be deleted.
        iModel.elements.deleteElement(e);
    }
  }
}

/** Deletes an entire element tree, including sub-models and child elements.
 * Items are deleted in bottom-up order. Definitions and Subjects are deleted after normal elements.
 * @alpha
 */
export class ElementTreeDeleter extends ElementTreeBottomUp {
  private _special: SpecialElements = new SpecialElements();
  private _topElement: Id64String;
  private _topScope: ElementTreeWalkerScope;

  public constructor(iModel: IModelDb, topElement: Id64String, scope?: ElementTreeWalkerScope) {
    super(iModel);
    this._topElement = topElement;
    this._topScope = scope ?? ElementTreeWalkerScope.createTopScope(this._iModel, this._topElement);
  }

  protected override shouldExploreModel(_model: Model): boolean { return true; }
  protected override shouldVisitElement(_elementId: Id64String): boolean { return true; }

  protected override visitModel(model: Model, _scope: ElementTreeWalkerScope): void {
    if (isDefinitionModel(model))
      return; // we recorded definition models in visitElement when we encountered the DefinitionPartition elements.

    // visitElement was called first, and it deleted the elements in the model. So, now it's safe to delete the model itself.
    // TODO: will fail if model has an element that is sub-modeled by a **DefinitionModel**. I hope that never occurs!
    model.delete();
  }

  protected override visitElement(elementId: Id64String, _scope: ElementTreeWalkerScope): void {
    if (!this._special.recordSpecialElement(this._iModel, elementId)) {
      this._iModel.elements.deleteElement(elementId);
    }
  }

  /** Delete the element tree. */
  public deleteElementTree(): void {
    this.processElementTree(this._topElement, this._topScope); // Delete the "normal" elements and record the special elements for deferred processing
    this._special.deleteSpecialElements(this._iModel);
  }

}

/** Does a breadth-first search on the tree defined by an element and its sub-models and children.
 * Parents are visited first, then children, then sub-models.
 * The subclass can "prune" sub-trees from the search. When a sub-tree is "pruned" the search does *not* recurse into it.
 * If a sub-tree is not pruned, then the search does recurse into it.
 * @alpha
 */
abstract class ElementTreeTopDown {
  constructor(protected _iModel: IModelDb) { }

  /** Should the search *not* recurse into this sub-tree? */
  protected shouldPrune(_elementId: Id64String, _scope: ElementTreeWalkerScope): boolean { return false; }

  protected abstract prune(_elementId: Id64String, _scope: ElementTreeWalkerScope): void;

  protected processElementTree(element: Id64String, scope: ElementTreeWalkerScope) {

    if (this.shouldPrune(element, scope)) {
      this.prune(element, scope);
      return;
    }

    this._processChildren(element, scope);

    const subModel = this._iModel.models.tryGetModel<Model>(element);
    if (subModel !== undefined) {
      this._processSubModel(subModel, scope);
    }
  }

  private _processChildren(element: Id64String, scope: ElementTreeWalkerScope) {
    let parentScope: ElementTreeWalkerScope | undefined;
    for (const childElement of this._iModel.elements.queryChildren(element)) {
      if (parentScope === undefined)
        parentScope = new ElementTreeWalkerScope(scope, element);
      this.processElementTree(childElement, parentScope);
    }
  }

  private _processSubModel(subModel: Model, scope: ElementTreeWalkerScope) {
    const subModelScope = new ElementTreeWalkerScope(scope, subModel);
    // Visit only the top-level parents. processElementTree will recurse into their children.
    this._iModel.withPreparedStatement(`select ECInstanceId from bis:Element where Model.id=? and Parent.Id is null`, (stmt) => {
      stmt.bindId(1, subModel.id);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const elementId = stmt.getValue(0).getId();
        this.processElementTree(elementId, subModelScope);
      }
    });
  }

}

/** Signature of the filter function used by ElementSubTreeDeleter.
 * @param elementId The sub-tree parent element.
 * @param scope The path followed by the top-down search to the element
 * @return true if the element and its children and sub-models should be deleted.
 * @alpha
 */
export type ElementSubTreeDeleteFilter = (elementId: Id64String, scope: ElementTreeWalkerScope) => boolean;

/** Deletes the element sub-trees that are chosen by a supplied filter function.
 * This class uses ElementTreeTopDown to visit element sub-trees in top-down order.
 * When the filter function chooses a sub-tree, this class uses ElementTreeDeleter to delete it.
 * Note that when a sub-tree is selected and deleted, its children and sub-models are not visited.
 * @alpha
 */
export class ElementSubTreeDeleter extends ElementTreeTopDown {
  private _special: SpecialElements = new SpecialElements();

  private _topElement: Id64String;
  private _topScope: ElementTreeWalkerScope;

  private _shouldPruneCb: ElementSubTreeDeleteFilter;

  /** Construct an ElementSubTreeDeleter. @see pruneElementTree.
   * @param iModel The iModel
   * @param topElement Where to start the search.
   * @param shouldPruneCb Callback that selects sub-trees that should be deleted.
   */
  public constructor(iModel: IModelDb, topElement: Id64String, shouldPruneCb: ElementSubTreeDeleteFilter, scope?: ElementTreeWalkerScope) {
    super(iModel);
    this._topElement = topElement;
    this._topScope = scope ?? ElementTreeWalkerScope.createTopScope(this._iModel, this._topElement);
    this._shouldPruneCb = shouldPruneCb;
  }

  protected override shouldPrune(elementId: Id64String, scope: ElementTreeWalkerScope): boolean { return this._shouldPruneCb(elementId, scope); }

  protected prune(elementId: Id64String, scope: ElementTreeWalkerScope): void {
    if (!this._special.recordSpecialElement(this._iModel, elementId)) {
      const del = new ElementTreeDeleter(this._iModel, elementId, scope);
      del.deleteElementTree();
    }
  }

  /** Traverses the tree of elements, beginning with the top element, and deletes all selected sub-trees. */
  public pruneElementTree() {
    this.processElementTree(this._topElement, this._topScope); // deletes normal elements and their sub-trees, defers special elements
    this._special.deleteSpecialElements(this._iModel);
  }
}

/** Deletes an element tree starting with the specified top element. The top element is also deleted. Uses ElementTreeDeleter.
 * @param iModel The iModel
 * @param topElement The parent of the sub-tree
 * @alpha
 */
export function deleteElementTree(iModel: IModelDb, topElement: Id64String): void {
  const del = new ElementTreeDeleter(iModel, topElement);
  del.deleteElementTree();
}

/** Deletes all element sub-trees that are selected by the supplied filter. Uses ElementSubTreeDeleter.
 * @remarks If the filter selects the top element itself, then the entire tree (including the top element) is deleted.
 * That has the same effect as calling [[deleteElementTree]] on the top element.
 * @param iModel The iModel
 * @param topElement Where to start the search.
 * @param filter Callback that selects sub-trees that should be deleted.
 * @alpha
 */
export function deleteElementSubTrees(iModel: IModelDb, topElement: Id64String, filter: ElementSubTreeDeleteFilter): void {
  const del = new ElementSubTreeDeleter(iModel, topElement, filter);
  del.pruneElementTree();
}

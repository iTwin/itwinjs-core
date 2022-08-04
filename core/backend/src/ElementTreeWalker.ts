/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert as beAssert, DbResult, Id64Array, Id64String, Logger } from "@itwin/core-bentley";
import {
  IModel, IModelError, IModelStatus,
} from "@itwin/core-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { DefinitionElement, DefinitionPartition, Subject } from "./Element";
import { IModelDb } from "./IModelDb";
import { DefinitionModel, Model } from "./Model";

const loggerCategory = BackendLoggerCategory.IModelDb;

interface ElementTreeWalkerModelInfo { model: Model, isDefn: boolean }

export function isDefinitionModel(model: Model): boolean {
  return (model.id !== IModel.repositoryModelId) && (model instanceof DefinitionModel);
}

export function isDefinitionElement(imodel: IModelDb, elid: Id64String): boolean {
  const el = imodel.elements.getElement(elid);
  return el instanceof DefinitionElement;
}

export function isDefinitionPartitionElement(imodel: IModelDb, elid: Id64String): boolean {
  const el = imodel.elements.getElement(elid);
  return el instanceof DefinitionPartition;
}

// function isSubjectElement(imodel: IModelDb, elid: Id64String): boolean {
//   const el = imodel.elements.getElement(elid);
//   return el instanceof Subject;
// }

export enum ElementPruningClassification { PRUNING_CLASS_Normal = 0, PRUNING_CLASS_Subject = 1, PRUNING_CLASS_Definition = 2, PRUNING_CLASS_DefinitionPartition = 3, }

export function classifyElementForPruning(imodel: IModelDb, elid: Id64String): ElementPruningClassification {
  const el = imodel.elements.getElement(elid);
  return (el instanceof Subject) ? ElementPruningClassification.PRUNING_CLASS_Subject :
    (el instanceof DefinitionElement) ? ElementPruningClassification.PRUNING_CLASS_Definition :
      (el instanceof DefinitionPartition) ? ElementPruningClassification.PRUNING_CLASS_DefinitionPartition :
        ElementPruningClassification.PRUNING_CLASS_Normal;
}

/** Records how an element or model was reached during a tree search. This object is immutable. */
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
export abstract class ElementTreeBottomUp {
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
      model.delete(); // TODO: will fail if model has an element that is submodelled by a **DefinitionModel**. I hope that never occurs!
  }

  // Delete the "normal" elements and record the definitions and Subjects for deferred processing
  public override visitElement(elid: Id64String, scope: ElementTreeWalkerScope): void {
    // Defer Definitions and Subjects
    if (scope.inRepositoryModel) {
      const cls = classifyElementForPruning(this._imodel, elid);
      if (cls === ElementPruningClassification.PRUNING_CLASS_Subject) {
        this._subjects.push(elid);
        return;
      } else if (cls === ElementPruningClassification.PRUNING_CLASS_Definition) {
        this._definitions.push(elid);
        return;
      } else if (cls === ElementPruningClassification.PRUNING_CLASS_DefinitionPartition) {
        // We will record it in the visitModel callback
      }
    } else if (scope.inDefinitionModel) {
      if (isDefinitionElement(this._imodel, elid)) {
        this._definitions.push(elid);
        return;
      }
    }

    if (isDefinitionPartitionElement(this._imodel, elid)) {
      // We will record it in the visitModel callback
      return;
    }

    // This is a normal element. We can delete it now, because we know that its children and sub-models are already gone.
    try {
      Logger.logTrace(loggerCategory, `Delete ${elid} in scope ${scope}`);
      this._imodel.elements.deleteElement(elid);
    } catch (err) {
      // we sometimes see child elements twice when traversing a model.
      if (!(err instanceof IModelError) || err.errorNumber !== IModelStatus.NotFound)
        throw err;
    }

  }

  public deleteElementTree(topElement: Id64String, scope?: ElementTreeWalkerScope): void {
    // Deletes the "normal" elements and records the definitions and Subjects for deferred processing
    this.processElementTree(topElement, scope ?? ElementTreeWalkerScope.createTopScope(this._imodel, topElement));

    // Now the (unused) definitions can be deleted
    Logger.logTrace(loggerCategory, `Delete definition elements ${JSON.stringify(this._definitions)}`);
    this._imodel.elements.deleteDefinitionElements(this._definitions); // (will not delete definitions that are still in use)

    for (const m of this._definitionModels) {
      try {
        Logger.logTrace(loggerCategory, `Delete definition model ${m}`);
        this._imodel.models.deleteModel(m);
        this._imodel.elements.deleteElement(m);
      } catch (err) {
        // will fail if some of the definitions in the model could not be deleted
        // TODO: Check that this is because defn is still in use.
      }
    }

    // Finally, delete the parent Subjects. (We defer them, because some of them may be the parents
    // of child definition models, and we have to wait until we have deleted those child models.)
    for (const e of this._subjects) {
      try {
        Logger.logTrace(loggerCategory, `Delete Subject ${e}`);
        this._imodel.elements.deleteElement(e);
      } catch (err) {
        // will fail if the subject still has children, e.g., because a child definition model could not be deleted in the loop above.
        // TODO: Check that this is because defn child model still exists
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

export type ElementSubTreePruneFilter = (_elid: Id64String, _scope: ElementTreeWalkerScope) => boolean;

class SelectedElementSubTreeDeleter extends ElementTreeTopDown {
  private _definitions: Id64Array = [];
  private _subjects: Id64Array = [];

  constructor(imodel: IModelDb, private _topElement: Id64String, private _shouldPruneCb: ElementSubTreePruneFilter) {
    super(imodel);
  }

  public override shouldPrune(elid: Id64String, scope: ElementTreeWalkerScope): boolean { return this._shouldPruneCb(elid, scope); }

  public prune(elid: Id64String, scope: ElementTreeWalkerScope): void {
    // Defer Definitions and Subjects
    if (scope.inRepositoryModel) {
      const cls = classifyElementForPruning(this._imodel, elid);
      if (cls === ElementPruningClassification.PRUNING_CLASS_Subject) {
        this._subjects.push(elid);
        return;
      } else if (cls === ElementPruningClassification.PRUNING_CLASS_Definition || cls === ElementPruningClassification.PRUNING_CLASS_DefinitionPartition) {
        this._definitions.push(elid);
        return;
      }
    } else if (scope.inDefinitionModel) {
      this._definitions.push(elid);
      return;
    }

    // This is a normal element.
    const del = new ElementTreeDeleter(this._imodel);
    del.deleteElementTree(elid, scope);
  }

  public pruneElementTree() {
    this.processElementTree(this._topElement, ElementTreeWalkerScope.createTopScope(this._imodel, this._topElement)); // deletes normal elements and their sub-trees

    const del = new ElementTreeDeleter(this._imodel);

    for (const elid of this._definitions) // unused definitions can now be deleted
      del.deleteElementTree(elid);

    for (const elid of this._subjects) { // finally subjects can be deleted
      del.deleteElementTree(elid);
    }
  }
}

/** Delete an element tree starting with the specified top element. The top element is also deleted.
 * @param imodel The iModel
 * @param topElement The parent of the sub-tree
 */
export function deleteElementTree(imodel: IModelDb, topElement: Id64String): void {
  const del = new ElementTreeDeleter(imodel);
  del.deleteElementTree(topElement);
}

/** Delete all element sub-trees that are selected by the supplied filter.
 * @remarks If the filter selects the top element itself, then the entire tree (including the top element) is deleted.
 * That has the same effect as calling [[deleteElementTree]] on the top element.
 * @param imodel The iModel
 * @param topElement The parent of the sub-tree
 */
export function deleteElementSubTrees(imodel: IModelDb, topElement: Id64String, filter: ElementSubTreePruneFilter): void {
  const del = new SelectedElementSubTreeDeleter(imodel, topElement, filter);
  del.pruneElementTree();
}

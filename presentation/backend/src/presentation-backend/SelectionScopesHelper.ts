/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import type { Id64String } from "@itwin/core-bentley";
import { DbResult, Id64 } from "@itwin/core-bentley";
import type { IModelDb } from "@itwin/core-backend";
import { GeometricElement, GeometricElement3d } from "@itwin/core-backend";
import type {
  InstanceKey, SelectionScope, SelectionScopeRequestOptions} from "@itwin/presentation-common";
import { KeySet, PresentationError, PresentationStatus,
} from "@itwin/presentation-common";
import { getElementKey } from "./Utils";

/**
 * Contains helper methods for computing selection scopes. Will get removed
 * once rules-driven scopes are implemented.
 *
 * @internal
 */
export class SelectionScopesHelper {

  // istanbul ignore next
  private constructor() { }

  public static getSelectionScopes(): SelectionScope[] {
    const createSelectionScope = (scopeId: string, label: string, description: string): SelectionScope => ({
      id: scopeId,
      label,
      description,
    });
    return [
      createSelectionScope("element", "Element", "Select the picked element"),
      createSelectionScope("assembly", "Assembly", "Select parent of the picked element"),
      createSelectionScope("top-assembly", "Top Assembly", "Select the topmost parent of the picked element"),
      // WIP: temporarily comment-out "category" and "model" scopes since we can't hilite contents of them fast enough
      // createSelectionScope("category", "Category", "Select all elements in the picked element's category"),
      // createSelectionScope("model", "Model", "Select all elements in the picked element's model"),
    ];
  }

  private static computeElementSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const key = getElementKey(requestOptions.imodel, id);
      if (key)
        keys.add(key);
    }));
    return keys;
  }

  private static getParentInstanceKey(imodel: IModelDb, id: Id64String): InstanceKey | undefined {
    const elementProps = imodel.elements.tryGetElementProps(id);
    if (!elementProps?.parent)
      return undefined;
    return getElementKey(imodel, elementProps.parent.id);
  }

  private static getAssemblyKey(imodel: IModelDb, id: Id64String) {
    const parentKey = this.getParentInstanceKey(imodel, id);
    if (parentKey)
      return parentKey;
    return getElementKey(imodel, id);
  }

  private static computeAssemblySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const parentKeys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const key = this.getAssemblyKey(requestOptions.imodel, id);
      if (key)
        parentKeys.add(key);
    }));
    return parentKeys;
  }

  private static getTopAssemblyKey(imodel: IModelDb, id: Id64String) {
    let currKey: InstanceKey | undefined;
    let parentKey = this.getParentInstanceKey(imodel, id);
    while (parentKey) {
      currKey = parentKey;
      parentKey = this.getParentInstanceKey(imodel, currKey.id);
    }
    return currKey ?? getElementKey(imodel, id);
  }

  private static computeTopAssemblySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const parentKeys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const key = this.getTopAssemblyKey(requestOptions.imodel, id);
      if (key)
        parentKeys.add(key);
    }));
    return parentKeys;
  }

  private static computeCategorySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const categoryKeys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const el = requestOptions.imodel.elements.tryGetElement(id);
      if (el instanceof GeometricElement) {
        const category = requestOptions.imodel.elements.tryGetElementProps(el.category);
        if (category)
          categoryKeys.add({ className: category.classFullName, id: category.id! });
      }
    }));
    return categoryKeys;
  }

  private static computeModelSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const modelKeys = new KeySet();
    ids.forEach(skipTransients((id) => {
      const el = requestOptions.imodel.elements.tryGetElementProps(id);
      const model = el ? requestOptions.imodel.models.tryGetModelProps(el.model) : undefined;
      if (model)
        modelKeys.add({ className: model.classFullName, id: model.id! });
    }));
    return modelKeys;
  }

  private static getRelatedFunctionalElementKey(imodel: IModelDb, graphicalElementId: Id64String): InstanceKey | undefined {
    const query = `
      SELECT funcSchemaDef.Name || '.' || funcClassDef.Name funcElClassName, fe.ECInstanceId funcElId
        FROM bis.Element e
        LEFT JOIN func.PhysicalElementFulfillsFunction rel1 ON rel1.SourceECInstanceId = e.ECInstanceId
        LEFT JOIN func.DrawingGraphicRepresentsFunctionalElement rel2 ON rel2.SourceECInstanceId = e.ECInstanceId
        LEFT JOIN func.FunctionalElement fe ON fe.ECInstanceId IN (rel1.TargetECInstanceId, rel2.TargetECInstanceId)
        INNER JOIN meta.ECClassDef funcClassDef ON funcClassDef.ECInstanceId = fe.ECClassId
        INNER JOIN meta.ECSchemaDef funcSchemaDef ON funcSchemaDef.ECInstanceId = funcClassDef.Schema.Id
       WHERE e.ECInstanceId = ?
      `;
    return imodel.withPreparedStatement(query, (stmt): InstanceKey | undefined => {
      stmt.bindId(1, graphicalElementId);
      // istanbul ignore else
      if (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const row = stmt.getRow();
        if (row.funcElClassName && row.funcElId)
          return { className: row.funcElClassName.replace(".", ":"), id: row.funcElId };
      }
      return undefined;
    });
  }

  private static findFirstRelatedFunctionalElementKey(imodel: IModelDb, graphicalElementId: Id64String): InstanceKey | undefined {
    let currId: Id64String | undefined = graphicalElementId;
    while (currId) {
      const relatedFunctionalKey = this.getRelatedFunctionalElementKey(imodel, currId);
      if (relatedFunctionalKey)
        return relatedFunctionalKey;
      currId = this.getParentInstanceKey(imodel, currId)?.id;
    }
    return undefined;
  }

  private static elementClassDerivesFrom(imodel: IModelDb, elementId: Id64String, baseClassFullName: string): boolean {
    const query = `
      SELECT 1
        FROM bis.Element e
        INNER JOIN meta.ClassHasAllBaseClasses baseClassRels ON baseClassRels.SourceECInstanceId = e.ECClassId
        INNER JOIN meta.ECClassDef baseClass ON baseClass.ECInstanceId = baseClassRels.TargetECInstanceId
        INNER JOIN meta.ECSchemaDef baseSchema ON baseSchema.ECInstanceId = baseClass.Schema.Id
       WHERE e.ECInstanceId = ? AND (baseSchema.Name || ':' || baseClass.Name) = ?
      `;
    return imodel.withPreparedStatement(query, (stmt): boolean => {
      stmt.bindId(1, elementId);
      stmt.bindString(2, baseClassFullName);
      return (DbResult.BE_SQLITE_ROW === stmt.step());
    });
  }

  private static computeFunctionalElementSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(skipTransients((id): void => {
      const is3d = this.elementClassDerivesFrom(requestOptions.imodel, id, GeometricElement3d.classFullName);
      if (!is3d) {
        // if the input is not a 3d element, we try to find the first related functional element
        const firstFunctionalKey = this.findFirstRelatedFunctionalElementKey(requestOptions.imodel, id);
        if (firstFunctionalKey) {
          keys.add(firstFunctionalKey);
          return;
        }
      }
      let keyToAdd: InstanceKey | undefined;
      if (is3d) {
        // if we're computing scope for a 3d element, try to switch to its related functional element
        keyToAdd = this.getRelatedFunctionalElementKey(requestOptions.imodel, id);
      }
      if (!keyToAdd)
        keyToAdd = getElementKey(requestOptions.imodel, id);
      keyToAdd && keys.add(keyToAdd);
    }));
    return keys;
  }

  private static computeFunctionalAssemblySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(skipTransients((id): void => {
      let idToGetAssemblyFor = id;
      const is3d = this.elementClassDerivesFrom(requestOptions.imodel, id, GeometricElement3d.classFullName);
      if (!is3d) {
        // if the input is not a 3d element, we try to find the first related functional element
        const firstFunctionalKey = this.findFirstRelatedFunctionalElementKey(requestOptions.imodel, id);
        if (firstFunctionalKey)
          idToGetAssemblyFor = firstFunctionalKey.id;
      }
      // find the assembly of either the given element or the functional element
      const assemblyKey = this.getAssemblyKey(requestOptions.imodel, idToGetAssemblyFor);
      let keyToAdd = assemblyKey;
      if (is3d && keyToAdd) {
        // if we're computing scope for a 3d element, try to switch to its related functional element
        const relatedFunctionalKey = this.getRelatedFunctionalElementKey(requestOptions.imodel, keyToAdd.id);
        if (relatedFunctionalKey)
          keyToAdd = relatedFunctionalKey;
      }
      keyToAdd && keys.add(keyToAdd);
    }));
    return keys;
  }

  private static computeFunctionalTopAssemblySelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(skipTransients((id): void => {
      let idToGetAssemblyFor = id;
      const is3d = this.elementClassDerivesFrom(requestOptions.imodel, id, GeometricElement3d.classFullName);
      if (!is3d) {
        // if the input is not a 3d element, we try to find the first related functional element
        const firstFunctionalKey = this.findFirstRelatedFunctionalElementKey(requestOptions.imodel, id);
        if (firstFunctionalKey)
          idToGetAssemblyFor = firstFunctionalKey.id;
      }
      // find the top assembly of either the given element or the functional element
      const topAssemblyKey = this.getTopAssemblyKey(requestOptions.imodel, idToGetAssemblyFor);
      let keyToAdd = topAssemblyKey;
      if (is3d && keyToAdd) {
        // if we're computing scope for a 3d element, try to switch to its related functional element
        const relatedFunctionalKey = this.getRelatedFunctionalElementKey(requestOptions.imodel, keyToAdd.id);
        if (relatedFunctionalKey)
          keyToAdd = relatedFunctionalKey;
      }
      keyToAdd && keys.add(keyToAdd);
    }));
    return keys;
  }

  /**
   * Computes selection set based on provided selection scope.
   * @param requestOptions Options for the request
   * @param keys Keys of elements to get the content for.
   * @param scopeId ID of selection scope to use for computing selection
   */
  public static async computeSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[], scopeId: string): Promise<KeySet> {
    switch (scopeId) {
      case "element": return this.computeElementSelection(requestOptions, ids);
      case "assembly": return this.computeAssemblySelection(requestOptions, ids);
      case "top-assembly": return this.computeTopAssemblySelection(requestOptions, ids);
      case "category": return this.computeCategorySelection(requestOptions, ids);
      case "model": return this.computeModelSelection(requestOptions, ids);
      case "functional":
      case "functional-element":
        return this.computeFunctionalElementSelection(requestOptions, ids);
      case "functional-assembly": return this.computeFunctionalAssemblySelection(requestOptions, ids);
      case "functional-top-assembly": return this.computeFunctionalTopAssemblySelection(requestOptions, ids);
    }
    throw new PresentationError(PresentationStatus.InvalidArgument, "scopeId");
  }

}

const skipTransients = (callback: (id: Id64String) => void) => {
  return (id: Id64String) => {
    if (!Id64.isTransient(id))
      callback(id);
  };
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { DbResult, Id64, Id64String } from "@bentley/bentleyjs-core";
import { GeometricElement, GeometricElement3d, IModelDb } from "@bentley/imodeljs-backend";
import {
  InstanceKey, KeySet, PresentationError, PresentationStatus, SelectionScope, SelectionScopeParams, SelectionScopeRequestOptions,
} from "@bentley/presentation-common";
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

  private static getElementKey(iModel: IModelDb, elementId: Id64String, ancestorLevel: number) {
    let currId = elementId;
    let parentId = iModel.elements.tryGetElementProps(currId)?.parent?.id;
    while (parentId && ancestorLevel !== 0) {
      currId = parentId;
      parentId = iModel.elements.tryGetElementProps(currId)?.parent?.id;
      --ancestorLevel;
    }
    return getElementKey(iModel, currId);
  }

  private static computeElementSelection(params: ComputeElementSelectionScopeProps) {
    const parentKeys = new KeySet();
    params.elementIds.forEach(skipTransients((id) => {
      const key = this.getElementKey(params.iModel, id, params.level);
      key && parentKeys.add(key);
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
      currId = imodel.elements.tryGetElementProps(currId)?.parent?.id;
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
      const assemblyKey = this.getElementKey(requestOptions.imodel, idToGetAssemblyFor, 1);
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
      const topAssemblyKey = this.getElementKey(requestOptions.imodel, idToGetAssemblyFor, Number.MAX_SAFE_INTEGER);
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
   * @param scopeParams Scope-specific params.
   */
  public static async computeSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[], scopeId: string, scopeParams?: SelectionScopeParams): Promise<KeySet> {
    switch (scopeId) {
      case "element": return this.computeElementSelection(createElementSelectionScopeProps(requestOptions, ids, scopeParams));
      case "assembly": return this.computeElementSelection(createElementSelectionScopeProps(requestOptions, ids, { level: 1 }));
      case "top-assembly": return this.computeElementSelection(createElementSelectionScopeProps(requestOptions, ids, { level: Number.MAX_SAFE_INTEGER }));
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

interface ComputeElementSelectionScopeProps {
  iModel: IModelDb;
  elementIds: Id64String[];
  level: number;
}
function createElementSelectionScopeProps(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[], scopeParams?: SelectionScopeParams) {
  const level = (scopeParams && typeof scopeParams === "object" && typeof scopeParams.level === "number") ? scopeParams.level : 0;
  return {
    iModel: requestOptions.imodel,
    elementIds: ids,
    level,
  };
}

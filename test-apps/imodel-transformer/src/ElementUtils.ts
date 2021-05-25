/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Id64Array, Id64Set, Id64String } from "@bentley/bentleyjs-core";
import {
  Category, CategorySelector, DisplayStyle, DisplayStyle3d, ECSqlStatement, ExternalSourceAspect, GeometricModel3d, IModelDb, ModelSelector,
  SpatialCategory, SpatialModel, SpatialViewDefinition, SubCategory, ViewDefinition,
} from "@bentley/imodeljs-backend";
import { IModel } from "@bentley/imodeljs-common";

export namespace ElementUtils {

  function queryElementIds(iModelDb: IModelDb, classFullName: string): Id64Set {
    const elementIds = new Set<Id64String>();
    iModelDb.withPreparedStatement(`SELECT ECInstanceId FROM ${classFullName}`, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        elementIds.add(statement.getValue(0).getId());
      }
    });
    return elementIds;
  }

  export function validateModelSelectors(iModelDb: IModelDb): void {
    const modelSelectorIds = queryElementIds(iModelDb, ModelSelector.classFullName);
    modelSelectorIds.forEach((modelSelectorId: Id64String) => {
      const modelSelector = iModelDb.elements.getElement<ModelSelector>(modelSelectorId, ModelSelector);
      validateModelSelector(modelSelector);
    });
  }

  function validateModelSelector(modelSelector: ModelSelector): void {
    const iModelDb = modelSelector.iModel;
    modelSelector.models.forEach((modelId: Id64String) => {
      iModelDb.models.getModel<GeometricModel3d>(modelId, GeometricModel3d); // will throw Error if not a valid GeometricModel3d
    });
  }

  export function validateCategorySelectors(iModelDb: IModelDb): void {
    const categorySelectorIds = queryElementIds(iModelDb, CategorySelector.classFullName);
    categorySelectorIds.forEach((categorySelectorId: Id64String) => {
      const categorySelector = iModelDb.elements.getElement<CategorySelector>(categorySelectorId, CategorySelector);
      validateCategorySelector(categorySelector);
    });
  }

  function validateCategorySelector(categorySelector: CategorySelector): void {
    const iModelDb = categorySelector.iModel;
    categorySelector.categories.forEach((categoryId: Id64String) => {
      iModelDb.elements.getElement<Category>(categoryId, Category); // will throw Error if not a valid Category
    });
  }

  export function validateDisplayStyles(iModelDb: IModelDb): void {
    const displayStyleIds = queryElementIds(iModelDb, DisplayStyle.classFullName);
    displayStyleIds.forEach((displayStyleId: Id64String) => {
      const displayStyle = iModelDb.elements.getElement<DisplayStyle>(displayStyleId, DisplayStyle);
      validateDisplayStyle(displayStyle);
    });
  }

  function validateDisplayStyle(displayStyle: DisplayStyle): void {
    const iModelDb = displayStyle.iModel;
    if (displayStyle.settings?.subCategoryOverrides) {
      for (const subCategoryId of displayStyle.settings.subCategoryOverrides.keys()) {
        iModelDb.elements.getElement<SubCategory>(subCategoryId, SubCategory); // will throw Error if not a valid SubCategory
      }
    }
    if (displayStyle.settings?.excludedElementIds) {
      for (const elementId of displayStyle.settings.excludedElementIds) {
        iModelDb.elements.getElement(elementId); // will throw Error if not a valid Element
      }
    }
  }

  export function queryProvenanceScopeIds(iModelDb: IModelDb): Id64Set {
    const elementIds = new Set<Id64String>();
    if (iModelDb.containsClass(ExternalSourceAspect.classFullName)) {
      const sql = `SELECT Element.Id FROM ${ExternalSourceAspect.classFullName} WHERE Kind=:kind`;
      iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
        statement.bindString("kind", ExternalSourceAspect.Kind.Scope);
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          elementIds.add(statement.getValue(0).getId());
        }
      });
    }
    return elementIds;
  }

  /** Generate and insert a ViewDefinition that views all models and all SpatialCategories.
   * @param iModelDb The ViewDefinition will be inserted into this IModelDb.
   * @param name The name (CodeValue) for the inserted ViewDefinition.
   * @param makeDefault If `true` make the inserted ViewDefinition the default view.
   * @returns The Id of the ViewDefinition that was found or inserted.
   */
  export function insertViewDefinition(iModelDb: IModelDb, name: string, makeDefault?: boolean): Id64String {
    const definitionModelId = IModel.dictionaryId;
    const viewCode = ViewDefinition.createCode(iModelDb, definitionModelId, name);
    let viewId = iModelDb.elements.queryElementIdByCode(viewCode);
    if (viewId === undefined) {
      const modelSelectorId = ModelSelector.insert(iModelDb, definitionModelId, name, queryModelIds(iModelDb, SpatialModel.classFullName));
      const categorySelectorId = CategorySelector.insert(iModelDb, definitionModelId, name, querySpatialCategoryIds(iModelDb));
      const displayStyleId = DisplayStyle3d.insert(iModelDb, definitionModelId, name);
      viewId = SpatialViewDefinition.insertWithCamera(iModelDb, definitionModelId, name, modelSelectorId, categorySelectorId, displayStyleId, iModelDb.projectExtents);
      if (makeDefault) {
        iModelDb.views.setDefaultViewId(viewId);
      }
      iModelDb.saveChanges("Inserted ViewDefinition");
    }
    return viewId;
  }

  function queryModelIds(iModelDb: IModelDb, modelClassFullName: string): Id64Array {
    const modelIds: Id64Array = [];
    const sql = `SELECT ECInstanceId FROM ${modelClassFullName} WHERE IsTemplate=false`;
    iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        modelIds.push(statement.getValue(0).getId());
      }
    });
    return modelIds;
  }

  function querySpatialCategoryIds(iModelDb: IModelDb): Id64Array {
    const categoryIds: Id64Array = [];
    const sql = `SELECT ECInstanceId FROM ${SpatialCategory.classFullName}`;
    iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        categoryIds.push(statement.getValue(0).getId());
      }
    });
    return categoryIds;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Id64Set, Id64String } from "@bentley/bentleyjs-core";
import {
  Category, CategorySelector, DisplayStyle, ECSqlStatement, GeometricModel3d, IModelDb, ModelSelector, SubCategory,
} from "@bentley/imodeljs-backend";

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
  }
}

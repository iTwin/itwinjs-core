/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { FeatureSymbology, EmphasizeElements, Viewport, IModelConnection, FeatureOverrideProvider } from "@bentley/imodeljs-frontend";
import { Id64String, BeEvent } from "@bentley/bentleyjs-core";
import { Presentation } from "@bentley/presentation-frontend";
import { UiFramework } from "../UiFramework";
import { GeometricElementProps, ElementProps } from "@bentley/imodeljs-common";

/** Overrides given models to provide emphasize functionality
 * @alpha
 */
// istanbul ignore next
class ModelOverrideProvider implements FeatureOverrideProvider {
  constructor(public modelIds: string[], public defaultAppearance: FeatureSymbology.Appearance) { }

  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, _viewport: Viewport): void {
    overrides.setDefaultOverrides(this.defaultAppearance, true);
    // Override with nothing so that we keep the model looking normal and override the default appearance of everything else
    const emptyAppearance = FeatureSymbology.Appearance.fromJSON({});
    this.modelIds.forEach((modelId: string) => {
      overrides.overrideModel(modelId, emptyAppearance, true);
    });
  }
}

/** Overrides given categories to provide emphasize functionality
 *  @alpha
 */
// istanbul ignore next
class SubCategoryOverrideProvider implements FeatureOverrideProvider {
  constructor(public subCategoryIds: string[], public defaultAppearance: FeatureSymbology.Appearance) { }

  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, _viewport: Viewport): void {
    overrides.setDefaultOverrides(this.defaultAppearance, true);
    // Override with nothing so that we keep the category looking normal and override the default appearance of everything else
    const emptyAppearance = FeatureSymbology.Appearance.fromJSON({});
    this.subCategoryIds.forEach((id: string) => {
      overrides.overrideSubCategory(id, emptyAppearance, true);
    });
  }
}

/** Cache of Models that are inside of subjects */
// istanbul ignore next
class SubjectModelIdsCache {
  private _imodel: IModelConnection;
  private _subjectsHierarchy: Map<Id64String, Id64String[]> | undefined;
  private _subjectModels: Map<Id64String, Id64String[]> | undefined;
  private _init: Promise<void> | undefined;

  constructor(imodel: IModelConnection) {
    this._imodel = imodel;
  }

  private async initSubjectsHierarchy() {
    this._subjectsHierarchy = new Map();
    const ecsql = `SELECT ECInstanceId id, Parent.Id parentId FROM bis.Subject WHERE Parent IS NOT NULL`;
    const result = this._imodel.query(ecsql, undefined, 1000);
    for await (const row of result) {
      let list = this._subjectsHierarchy.get(row.parentId);
      if (!list) {
        list = [];
        this._subjectsHierarchy.set(row.parentId, list);
      }
      list.push(row.id);
    }
  }

  private async initSubjectModels() {
    this._subjectModels = new Map();
    const ecsql = `SELECT p.ECInstanceId id, p.Parent.Id subjectId FROM bis.InformationPartitionElement p JOIN bis.Model m ON m.ModeledElement.Id = p.ECInstanceId`;
    const result = this._imodel.query(ecsql, undefined, 1000);
    for await (const row of result) {
      let list = this._subjectModels.get(row.subjectId);
      if (!list) {
        list = [];
        this._subjectModels.set(row.subjectId, list);
      }
      list.push(row.id);
    }
  }

  private async initCache() {
    if (!this._init) {
      this._init = Promise.all([this.initSubjectModels(), this.initSubjectsHierarchy()]).then(() => { });
    }
    return this._init;
  }

  private appendSubjectModelsRecursively(modelIds: Id64String[], subjectId: Id64String) {
    const subjectModelIds = this._subjectModels!.get(subjectId);
    if (subjectModelIds)
      modelIds.push(...subjectModelIds);

    const childSubjectIds = this._subjectsHierarchy!.get(subjectId);
    if (childSubjectIds)
      childSubjectIds.forEach((cs) => this.appendSubjectModelsRecursively(modelIds, cs));
  }

  public async getSubjectModelIds(subjectId: Id64String): Promise<Id64String[]> {
    await this.initCache();
    const modelIds = new Array<Id64String>();
    this.appendSubjectModelsRecursively(modelIds, subjectId);
    return modelIds;
  }
}

/** Provides helping functions for doing commands on logical selection like categories and subjects
 * @alpha
 */
// istanbul ignore next
export class SelectionContextUtilities {
  public static emphasizeElementsChanged = new BeEvent<() => void>();

  // TODO: We need to check the type by going to backend, not by using classnames
  private static _categoryClassName = "BisCore:SpatialCategory";
  private static _subjectClassName = "BisCore:Subject";
  private static _modelClassName = "BisCore:PhysicalModel";
  private static _subjectModelIdsCache: SubjectModelIdsCache | undefined = undefined;

  /**
   * Initialize the subject model cache
   * @param iModelConnection iModel to use for querying subject's models
   */
  public static initializeSubjectModelCache(iModelConnection: IModelConnection) {
    SelectionContextUtilities._subjectModelIdsCache = new SubjectModelIdsCache(iModelConnection);
  }

  /**
   * Returns true if the selection in presentation layer only has a single selection class and it is the given one
   * @param className ECClass name to check for
   */
  private static _checkClassSelected(className: string) {
    if (!UiFramework.getIModelConnection())
      throw new Error("NavigatorCommands: Undefined iModelConnection");

    const selection = Presentation.selection.getSelection(UiFramework.getIModelConnection()!);
    return selection.size === 1 && selection.instanceKeys.has(className);
  }

  /**
   * Gets the Ids of all elements selected that have the given class name
   * @param className ECClass name to check for
   */
  private static _getIdsOfClassName(className: string) {
    if (!UiFramework.getIModelConnection())
      throw new Error("NavigatorCommands: Undefined iModelConnection");

    const selection = Presentation.selection.getSelection(UiFramework.getIModelConnection()!);
    const ids: string[] = [];
    selection.instanceKeys.forEach((currentIds: Set<string>, key: string) => {
      if (key === className)
        ids.push(...currentIds);
    });
    return ids;
  }

  /** Returns true if there are only categories selected in presentation's logical selection */
  private static categorySelected() {
    return SelectionContextUtilities._checkClassSelected(SelectionContextUtilities._categoryClassName);
  }

  /** Returns true if there are only subjects selected in presentation's logical selection */
  private static subjectSelected() {
    return SelectionContextUtilities._checkClassSelected(SelectionContextUtilities._subjectClassName);
  }

  /** Returns true if a model is selected in presentation's logical selection */
  private static modelSelected() {
    return SelectionContextUtilities._checkClassSelected(SelectionContextUtilities._modelClassName);
  }

  /**
   * Hide the selected category found in presentation layer's logical selection
   * @param vp Viewport to affect
   */
  private static hideSelectedCategory(vp: Viewport) {
    const ids = SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._categoryClassName);
    vp.changeCategoryDisplay(ids, false);
  }

  /** Get sub categories that relate to the category Id */
  private static async _getSubCategories(iModelConnection: IModelConnection, categoryIds: string[]) {
    const allSubcats: string[] = [];
    const request = iModelConnection.subcategories.load(categoryIds);
    if (request)
      await request.promise;

    for (const categoryId of categoryIds) {
      const subcats = iModelConnection.subcategories.getSubCategories(categoryId);
      if (subcats)
        allSubcats.push(...subcats);
    }
    return allSubcats;
  }

  /**
   * Emphasize the selected category found in presentation layer's logical selection
   * @param vp Viewport to affect
   */
  public static async emphasizeSelectedCategory(vp: Viewport) {
    const ids = SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._categoryClassName);
    if (ids.length === 0)
      return;

    const defaultAppearance = EmphasizeElements.getOrCreate(vp).createDefaultAppearance();
    EmphasizeElements.clear(vp);
    const subcats = await this._getSubCategories(vp.iModel, ids);
    vp.featureOverrideProvider = new SubCategoryOverrideProvider(subcats, defaultAppearance);
  }

  /**
   * Query the model Id that models a subject
   * @param subjectId Subject Id to use in query
   */
  private static async _getModelIds(_subjectId: string): Promise<string[]> {
    return SelectionContextUtilities._subjectModelIdsCache!.getSubjectModelIds(_subjectId);
  }

  /**
   * Hide the selected subject's model found in the presentation layer's logical selection
   * @param vp Viewport to affect
   */
  private static async hideSelectedSubject(vp: Viewport) {
    const ids = SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._subjectClassName);
    if (ids.length === 0)
      return;

    const modelIds = await SelectionContextUtilities._getModelIds(ids[0]);
    vp.changeModelDisplay(modelIds, false);
  }

  /**
   * Isolate the selected subject's model found in the presentation layer's logical selection
   * @param vp Viewport to affect
   */
  private static async emphasizeSelectedSubject(vp: Viewport) {
    const ids = SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._subjectClassName);
    if (ids.length === 0)
      return;

    const modelIds = await SelectionContextUtilities._getModelIds(ids[0]);
    const defaultAppearance = EmphasizeElements.getOrCreate(vp).createDefaultAppearance();
    EmphasizeElements.clear(vp);
    vp.featureOverrideProvider = new ModelOverrideProvider(modelIds, defaultAppearance);
  }

  /**
   * Hide the selected model
   * @param vp Viewport to affect
   */
  private static hideSelectedModel(vp: Viewport) {
    const ids = SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._modelClassName);
    if (ids.length === 0)
      return;

    vp.changeModelDisplay(ids, false);
  }

  /**
   * Isolate the selected model
   * @param vp Viewport to affect
   */
  private static emphasizeSelectedModel(vp: Viewport) {
    const ids = SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._modelClassName);
    if (ids.length === 0)
      return;

    const defaultAppearance = EmphasizeElements.getOrCreate(vp).createDefaultAppearance();
    EmphasizeElements.clear(vp);
    vp.featureOverrideProvider = new ModelOverrideProvider(ids, defaultAppearance);
  }

  /**
   * Isolate the selected elements
   * @param vp Viewport to affect
   */
  public static isolateSelected(vp: Viewport) {
    // NavigatorApp.telemetry.trackIsolateSelectedElements();
    EmphasizeElements.getOrCreate(vp).isolateSelectedElements(vp); // Hide all but selected elements
  }

  /**
   * Hide the selected elements
   * @param vp Viewport to affect
   */
  public static hideSelected(vp: Viewport) {
    // NavigatorApp.telemetry.trackHideSelectedElements();
    EmphasizeElements.getOrCreate(vp).hideSelectedElements(vp); // Hide all selected elements
  }

  /**
   * Clear Hidden,Isolated, or Emphasized elements in specified view
   * @param vp Viewport to affect
   *
   */
  public static clearEmphasize(vp: Viewport | undefined) {
    if (vp)
      EmphasizeElements.clear(vp);
    SelectionContextUtilities.emphasizeElementsChanged.raiseEvent();
  }

  /**
   * Emphasize the selected elements from either presentation layer's logical selection or selected graphics
   * @param vp Viewport to affect
   * @param emphasisSilhouette defaults to true
   */
  public static async emphasizeSelected(vp: Viewport, emphasisSilhouette = true) {
    if (SelectionContextUtilities.categorySelected()) {
      await SelectionContextUtilities.emphasizeSelectedCategory(vp);
      return;
    } else if (SelectionContextUtilities.modelSelected()) {
      SelectionContextUtilities.emphasizeSelectedModel(vp);
      return;
    } else if (SelectionContextUtilities.subjectSelected()) {
      await SelectionContextUtilities.emphasizeSelectedSubject(vp);
      return;
    }

    // if (isVersionComparisonDisplayEnabled(vp)) {
    //   VersionCompareProvider.get(vp)!.emphasizeSelectedElements();
    //   vp.isFadeOutActive = true; // Enable flat alpha for greyed out elements…
    //   return;
    // }

    // NavigatorApp.telemetry.trackEmphasizeSelectedElements();
    const ee = EmphasizeElements.getOrCreate(vp);
    ee.wantEmphasis = emphasisSilhouette;
    ee.emphasizeSelectedElements(vp); // Emphasize elements by making all others grey/transparent
    vp.isFadeOutActive = true; // Enable flat alpha for greyed out elements…

    // logForTesting("ContextTools-Emphasize:", EmphasizeElements.get(vp)!.toJSON(vp));
    SelectionContextUtilities.emphasizeElementsChanged.raiseEvent();
  }

  /**
   * Isolate the selected subject's model found in the presentation layer's logical selection
   * @param vp Viewport to affect
   */
  public static async isolateSelectedSubject(vp: Viewport) {
    const ids = SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._subjectClassName);
    if (ids.length === 0)
      return;

    const modelIds = await SelectionContextUtilities._getModelIds(ids[0]);
    await vp.replaceViewedModels(modelIds);
  }

  /**
   * Isolate the selected model
   * @param vp Viewport to affect
   */
  public static async isolateSelectedModel(vp: Viewport) {
    const ids = SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._modelClassName);
    if (ids.length === 0)
      return;

    await vp.replaceViewedModels(ids);
  }

  /**
   * Isolate the selected category found in presentation layer's logical selection
   * @param vp Viewport to affect
   */
  private static isolateSelectedCategory(vp: Viewport) {
    const ids = new Set(SelectionContextUtilities._getIdsOfClassName(SelectionContextUtilities._categoryClassName));
    const categoriesToDrop: string[] = [];
    vp.view.categorySelector.categories.forEach((categoryId: string) => {
      if (!ids.has(categoryId))
        categoriesToDrop.push(categoryId);
    });
    vp.changeCategoryDisplay(categoriesToDrop, false);
    vp.changeCategoryDisplay(ids, true);
  }

  private static async getSelectionSetElementModels(iModel: IModelConnection) {
    const props = (await iModel.elements.getProps(iModel.selectionSet.elements)) as ElementProps[];
    const modelIds = new Set<string>();
    for (const prop of props)
      if (prop.model)
        modelIds.add(prop.model);
    return modelIds;
  }

  private static async getSelectionSetElementCategories(iModel: IModelConnection) {
    const props = (await iModel.elements.getProps(iModel.selectionSet.elements)) as GeometricElementProps[];
    const categoryIds = new Set<string>();
    for (const prop of props)
      if (prop.category)
        categoryIds.add(prop.category);
    return categoryIds;
  }

  /**
   * Isolate either based on Presentation selection, if defined, else the selected graphic elements
   * @param vp Viewport to affect
   */
  public static async isolateCommand(vp: Viewport) {
    if (SelectionContextUtilities.categorySelected()) {
      SelectionContextUtilities.isolateSelectedCategory(vp);
      return;
    } else if (SelectionContextUtilities.modelSelected()) {
      await SelectionContextUtilities.isolateSelectedModel(vp);
      return;
    } else if (SelectionContextUtilities.subjectSelected()) {
      await SelectionContextUtilities.isolateSelectedSubject(vp);
      return;
    }

    // Not sure best way to handle this
    // if (isVersionComparisonDisplayEnabled(vp)) {
    //  VersionCompareProvider.get(vp)!.isolateSelected();
    //  return;
    // }

    // NavigatorApp.telemetry.trackIsolateSelectedElements();
    EmphasizeElements.getOrCreate(vp).isolateSelectedElements(vp); // Hide all but selected elements
    // logForTesting("ContextTools-Isolate:", EmphasizeElements.get(vp)!.toJSON(vp));
    SelectionContextUtilities.emphasizeElementsChanged.raiseEvent();
  }

  /**
   * Isolate model from selected elements
   * @param vp Viewport to affect
   */
  public static async isolateSelectedElementsModel(vp: Viewport) {
    // NavigatorApp.telemetry.trackIsolateSelectedModels();
    const modelsToKeep = new Set(await SelectionContextUtilities.getSelectionSetElementModels(vp.iModel));
    await vp.replaceViewedModels(modelsToKeep);
    // ConfigManager.consoleLog("ContextTools-Isolate-Models: " + JSON.stringify([...modelsToKeep]));
  }

  /**
   * Isolate the selected category found in SelectionSet elements
   * @param vp Viewport to affect
   */
  public static async isolateSelectedElementsCategory(vp: Viewport) {
    const categoriesToKeep = new Set(await SelectionContextUtilities.getSelectionSetElementCategories(vp.iModel));
    const categoriesToTurnOff = [...vp.view.categorySelector.categories].filter((categoryId: string) => !categoriesToKeep.has(categoryId));
    vp.changeCategoryDisplay(categoriesToTurnOff, false);
    vp.changeCategoryDisplay(categoriesToKeep, true);
  }

  /**
   * Hide either based on Presentation selection, if defined, else the selected graphic elements
   * @param vp Viewport to affect
   */
  public static async hideCommand(vp: Viewport) {
    if (SelectionContextUtilities.categorySelected()) {
      SelectionContextUtilities.hideSelectedCategory(vp);
      return;
    } else if (SelectionContextUtilities.modelSelected()) {
      SelectionContextUtilities.hideSelectedModel(vp);
      return;
    } else if (SelectionContextUtilities.subjectSelected()) {
      await SelectionContextUtilities.hideSelectedSubject(vp);
      return;
    }

    // if (isVersionComparisonDisplayEnabled(vp)) {
    //   VersionCompareProvider.get(vp)!.hideSelected();
    //   return;
    // }

    // NavigatorApp.telemetry.trackHideSelectedElements();
    EmphasizeElements.getOrCreate(vp).hideSelectedElements(vp); // Hide selected elements
    // console.log("selectionset:" + vp.iModel.selectionSet.elements); // tslint:disable-line
    // logForTesting("ContextTools-Hide:", EmphasizeElements.get(vp)!.toJSON(vp));
    SelectionContextUtilities.emphasizeElementsChanged.raiseEvent();
  }

  /**
   * Hide the models defined by the elements in the current SelectionSet
   * @param vp Viewport to affect
   */
  public static async hideSelectedElementsModel(vp: Viewport) {
    // NavigatorApp.telemetry.trackHideSelectedModels();
    const modelIds = await SelectionContextUtilities.getSelectionSetElementModels(vp.iModel);
    vp.changeModelDisplay(modelIds, false);
    // ConfigManager.consoleLog("ContextTools-Hide-Models: " + JSON.stringify([...modelIds]));
  }

  /**
   * Hide the categories defined by the elements in the current SelectionSet
   * @param vp Viewport to affect
   */
  public static async hideSelectedElementsCategory(vp: Viewport) {
    // NavigatorApp.telemetry.trackHideSelectedCategories();
    const categoryIds = await SelectionContextUtilities.getSelectionSetElementCategories(vp.iModel);
    vp.changeCategoryDisplay(categoryIds, false);
    // ConfigManager.consoleLog("ContextTools-Hide-Categories: " + JSON.stringify([...categoryIds]));
  }

  /** Checks to see if any featureOverrideProviders are active */
  public static areFeatureOverridesActive(vp: Viewport): boolean {
    if (vp.featureOverrideProvider) {
      const emphasizeElementsProvider = vp.featureOverrideProvider instanceof EmphasizeElements ? vp.featureOverrideProvider : undefined;
      if (undefined !== emphasizeElementsProvider && emphasizeElementsProvider.isActive)
        return true;

      const modelOverrideProvider = vp.featureOverrideProvider instanceof ModelOverrideProvider ? vp.featureOverrideProvider : undefined;
      if (undefined !== modelOverrideProvider && modelOverrideProvider.modelIds.length > 0)
        return true;

      const subCategoryOverrideProvider = vp.featureOverrideProvider instanceof SubCategoryOverrideProvider ? vp.featureOverrideProvider : undefined;
      if (undefined !== subCategoryOverrideProvider && subCategoryOverrideProvider.subCategoryIds.length > 0)
        return true;
    }

    return false;
  }
}

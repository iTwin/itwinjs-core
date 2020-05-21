/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { BeEvent, Id64String } from "@bentley/bentleyjs-core";
import { ElementProps, GeometricElementProps } from "@bentley/imodeljs-common";
import { EmphasizeElements, FeatureOverrideProvider, FeatureSymbology, IModelApp, IModelConnection, ScreenViewport, Viewport } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import { UiFramework } from "../UiFramework";
import { SyncUiEventDispatcher } from "../syncui/SyncUiEventDispatcher";

/** Different Selection Context Action Types
 * @alpha
 */
export enum HideIsolateEmphasizeAction {
  HideSelected = "hideSelected",
  EmphasizeSelectedElements = "emphasizeSelectedElements",
  IsolateSelectedElements = "isolateSelectedElements",
  IsolateSelectedCategories = "isolateSelectedCategories",
  IsolateSelectedModels = "isolateSelectedModels",
  HideSelectedElements = "hideSelectedElements",
  HideSelectedModels = "hideSelectedModels",
  HideSelectedCategories = "hideSelectedCategories",
  ClearHiddenIsolatedEmphasized = "clearHiddenIsolatedEmphasized",
}

/** Selection Context Action Event Argument
 * @alpha
 */
export interface EmphasizeElementsChangedArgs {
  /** viewport where action was performed */
  readonly viewport: ScreenViewport;
  /** action being performed */
  readonly action: HideIsolateEmphasizeAction;
  /** only populate if there is only a single category selected in presentation's logical selection */
  readonly usingSingleSelectionCategory?: string;
  /** only populate if there is only a single subject selected in presentation's logical selection */
  readonly usingSingleSelectionSubject?: string;
  /** only populate if there is only a single model selected in presentation's logical selection */
  readonly usingSingleSelectionModel?: string;
}

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

/**
 * Interface for class that handles Hide, Isolate, and Emphasize Actions
 * @alpha
 */
export abstract class HideIsolateEmphasizeActionHandler {
  public static emphasizeElementsChanged = new BeEvent<() => void>();

  /** String Id sent to allow UI to refresh its display state.  */
  public static get hideIsolateEmphasizeUiSyncId() {
    return "selection-context-emphasize-elements-changed";
  }

  /**
   * Function run when `IsolateSelectedElementsModel` tool button is pressed
   */
  public abstract async processIsolateSelectedElementsModel(): Promise<void>;
  /**
   * Function run when `IsolateSelectedElementsModel` tool button is pressed
   */

  public abstract async processIsolateSelectedElementsCategory(): Promise<void>;

  /**
   * Function run when `HideSelectedElementsModel` tool button is pressed
   */
  public abstract async processIsolateSelected(): Promise<void>;

  /**
   * Function run when `HideSelectedElementsModel` tool button is pressed
   */
  public abstract async processHideSelectedElementsModel(): Promise<void>;

  /**
   * Function that is run when `HideSelectedElementsCategory` tool button is pressed
   */
  public abstract async processHideSelectedElementsCategory(): Promise<void>;

  /**
   * Function that is run when `HideSelected` tool button is pressed
   */
  public abstract async processHideSelected(): Promise<void>;

  /**
   * Function that is run when `EmphasizeSelected` tool button is pressed
   */
  public abstract async processEmphasizeSelected(): Promise<void>;

  /**
   * Function that is run when `ClearEmphasize` tool button is pressed
   */
  public abstract async processClearEmphasize(): Promise<void>;

  /**
   * Function that informs called if Hide, Isolate, or Emphasize of elements is active.
   */
  public abstract areFeatureOverridesActive(vp: Viewport): boolean;
}

/** Provides helper functions for doing commands on logical selection like categories and subjects.
 * @alpha
 */
// istanbul ignore next
export class HideIsolateEmphasizeManager extends HideIsolateEmphasizeActionHandler {
  // TODO: We need to check the type by going to backend, not by using classnames
  private static _categoryClassName = "BisCore:SpatialCategory";
  private static _subjectClassName = "BisCore:Subject";
  private static _modelClassName = "BisCore:PhysicalModel";
  private _subjectModelIdsCache: SubjectModelIdsCache | undefined = undefined;

  /**
   * Initialize the subject model cache
   * @param iModelConnection iModel to use for querying subject's models
   */
  public initializeSubjectModelCache(iModelConnection: IModelConnection) {
    this._subjectModelIdsCache = new SubjectModelIdsCache(iModelConnection);
  }

  /**
   * Returns true if the selection in presentation layer only has a single selection class and it is the given one
   * @param className ECClass name to check for
   */
  private _checkClassSelected(className: string) {
    if (!UiFramework.getIModelConnection())
      throw new Error("Undefined iModelConnection");

    const selection = Presentation.selection.getSelection(UiFramework.getIModelConnection()!);
    return selection.size === 1 && selection.instanceKeys.has(className);
  }

  /**
   * Gets the Ids of all elements selected that have the given class name
   * @param className ECClass name to check for
   */
  private _getIdsOfClassName(className: string) {
    if (!UiFramework.getIModelConnection())
      throw new Error("Undefined iModelConnection");

    const selection = Presentation.selection.getSelection(UiFramework.getIModelConnection()!);
    const ids: string[] = [];
    selection.instanceKeys.forEach((currentIds: Set<string>, key: string) => {
      if (key === className)
        ids.push(...currentIds);
    });
    return ids;
  }

  /** Returns true if there are only categories selected in presentation's logical selection */
  private categorySelected() {
    return this._checkClassSelected(HideIsolateEmphasizeManager._categoryClassName);
  }

  /** Returns true if there are only subjects selected in presentation's logical selection */
  private subjectSelected() {
    return this._checkClassSelected(HideIsolateEmphasizeManager._subjectClassName);
  }

  /** Returns true if a model is selected in presentation's logical selection */
  private modelSelected() {
    return this._checkClassSelected(HideIsolateEmphasizeManager._modelClassName);
  }

  /**
   * Hide the selected category found in presentation layer's logical selection
   * @param vp Viewport to affect
   */
  private hideSelectedCategory(vp: Viewport) {
    const ids = this._getIdsOfClassName(HideIsolateEmphasizeManager._categoryClassName);
    vp.changeCategoryDisplay(ids, false);
  }

  /** Get sub categories that relate to the category Id */
  private async _getSubCategories(iModelConnection: IModelConnection, categoryIds: string[]) {
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
  public async emphasizeSelectedCategory(vp: Viewport) {
    const ids = this._getIdsOfClassName(HideIsolateEmphasizeManager._categoryClassName);
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
  private async _getModelIds(_subjectId: string): Promise<string[]> {
    return this._subjectModelIdsCache!.getSubjectModelIds(_subjectId);
  }

  /**
   * Hide the selected subject's model found in the presentation layer's logical selection
   * @param vp Viewport to affect
   */
  private async hideSelectedSubject(vp: Viewport) {
    const ids = this._getIdsOfClassName(HideIsolateEmphasizeManager._subjectClassName);
    if (ids.length === 0)
      return;

    const modelIds = await this._getModelIds(ids[0]);
    vp.changeModelDisplay(modelIds, false);
  }

  /**
   * Isolate the selected subject's model found in the presentation layer's logical selection
   * @param vp Viewport to affect
   */
  private async emphasizeSelectedSubject(vp: Viewport) {
    const ids = this._getIdsOfClassName(HideIsolateEmphasizeManager._subjectClassName);
    if (ids.length === 0)
      return;

    const modelIds = await this._getModelIds(ids[0]);
    const defaultAppearance = EmphasizeElements.getOrCreate(vp).createDefaultAppearance();
    EmphasizeElements.clear(vp);
    vp.featureOverrideProvider = new ModelOverrideProvider(modelIds, defaultAppearance);
  }

  /**
   * Hide the selected model
   * @param vp Viewport to affect
   */
  private hideSelectedModel(vp: Viewport) {
    const ids = this._getIdsOfClassName(HideIsolateEmphasizeManager._modelClassName);
    if (ids.length === 0)
      return;

    vp.changeModelDisplay(ids, false);
  }

  /**
   * Isolate the selected model
   * @param vp Viewport to affect
   */
  private emphasizeSelectedModel(vp: Viewport) {
    const ids = this._getIdsOfClassName(HideIsolateEmphasizeManager._modelClassName);
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
  public isolateSelected(vp: Viewport) {
    EmphasizeElements.getOrCreate(vp).isolateSelectedElements(vp); // Hide all but selected elements
    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({ viewport: vp, action: HideIsolateEmphasizeAction.IsolateSelectedElements });
    IModelApp.features.track(HideIsolateEmphasizeAction.IsolateSelectedElements);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /**
   * Hide the selected elements
   * @param vp Viewport to affect
   */
  public hideSelected(vp: Viewport) {
    EmphasizeElements.getOrCreate(vp).hideSelectedElements(vp); // Hide all selected elements
    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({ viewport: vp, action: HideIsolateEmphasizeAction.HideSelectedElements });
    IModelApp.features.track(HideIsolateEmphasizeAction.HideSelectedElements);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /**
   * Clear Hidden,Isolated, or Emphasized elements in specified view
   * @param vp Viewport to affect
   *
   */
  public clearEmphasize(vp: Viewport | undefined) {
    if (vp) {
      EmphasizeElements.clear(vp);
      HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({ viewport: vp, action: HideIsolateEmphasizeAction.ClearHiddenIsolatedEmphasized });
      IModelApp.features.track(HideIsolateEmphasizeAction.ClearHiddenIsolatedEmphasized);
      SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
    }
  }

  /**
   * Emphasize the selected elements from either presentation layer's logical selection or selected graphics
   * @param vp Viewport to affect
   * @param emphasisSilhouette defaults to true
   */
  public async emphasizeSelected(vp: Viewport, emphasisSilhouette = true) {
    let usingSingleSelectionCategory: string | undefined;
    let usingSingleSelectionSubject: string | undefined;
    let usingSingleSelectionModel: string | undefined;

    if (this.categorySelected()) {
      usingSingleSelectionCategory = HideIsolateEmphasizeManager._categoryClassName;
      await this.emphasizeSelectedCategory(vp);
      return;
    } else if (this.modelSelected()) {
      usingSingleSelectionModel = HideIsolateEmphasizeManager._modelClassName;
      this.emphasizeSelectedModel(vp);
      return;
    } else if (this.subjectSelected()) {
      usingSingleSelectionSubject = HideIsolateEmphasizeManager._subjectClassName;
      await this.emphasizeSelectedSubject(vp);
      return;
    }

    const ee = EmphasizeElements.getOrCreate(vp);
    ee.wantEmphasis = emphasisSilhouette;
    ee.emphasizeSelectedElements(vp); // Emphasize elements by making all others grey/transparent
    vp.isFadeOutActive = true; // Enable flat alpha for greyed out elements…

    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({
      viewport: vp, action: HideIsolateEmphasizeAction.EmphasizeSelectedElements,
      usingSingleSelectionCategory, usingSingleSelectionSubject, usingSingleSelectionModel,
    });
    IModelApp.features.track(HideIsolateEmphasizeAction.EmphasizeSelectedElements);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /**
   * Isolate the selected subject's model found in the presentation layer's logical selection
   * @param vp Viewport to affect
   */
  public async isolateSelectedSubject(vp: Viewport) {
    const ids = this._getIdsOfClassName(HideIsolateEmphasizeManager._subjectClassName);
    if (ids.length === 0)
      return;

    const modelIds = await this._getModelIds(ids[0]);
    await vp.replaceViewedModels(modelIds);
  }

  /**
   * Isolate the selected model
   * @param vp Viewport to affect
   */
  public async isolateSelectedModel(vp: Viewport) {
    const ids = this._getIdsOfClassName(HideIsolateEmphasizeManager._modelClassName);
    if (ids.length === 0)
      return;

    await vp.replaceViewedModels(ids);
  }

  /**
   * Isolate the selected category found in presentation layer's logical selection
   * @param vp Viewport to affect
   */
  private isolateSelectedCategory(vp: Viewport) {
    const ids = new Set(this._getIdsOfClassName(HideIsolateEmphasizeManager._categoryClassName));
    const categoriesToDrop: string[] = [];
    vp.view.categorySelector.categories.forEach((categoryId: string) => {
      if (!ids.has(categoryId))
        categoriesToDrop.push(categoryId);
    });
    vp.changeCategoryDisplay(categoriesToDrop, false);
    vp.changeCategoryDisplay(ids, true);
  }

  private async getSelectionSetElementModels(iModel: IModelConnection) {
    const props = (await iModel.elements.getProps(iModel.selectionSet.elements)) as ElementProps[];
    const modelIds = new Set<string>();
    for (const prop of props)
      if (prop.model)
        modelIds.add(prop.model);
    return modelIds;
  }

  private async getSelectionSetElementCategories(iModel: IModelConnection) {
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
  public async isolateCommand(vp: Viewport) {
    let usingSingleSelectionCategory: string | undefined;
    let usingSingleSelectionSubject: string | undefined;
    let usingSingleSelectionModel: string | undefined;

    if (this.categorySelected()) {
      usingSingleSelectionCategory = HideIsolateEmphasizeManager._categoryClassName;
      this.isolateSelectedCategory(vp);
      return;
    } else if (this.modelSelected()) {
      usingSingleSelectionModel = HideIsolateEmphasizeManager._modelClassName;
      await this.isolateSelectedModel(vp);
      return;
    } else if (this.subjectSelected()) {
      usingSingleSelectionSubject = HideIsolateEmphasizeManager._subjectClassName;
      await this.isolateSelectedSubject(vp);
      return;
    }

    EmphasizeElements.getOrCreate(vp).isolateSelectedElements(vp); // Hide all but selected elements
    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({
      viewport: vp, action: HideIsolateEmphasizeAction.IsolateSelectedElements,
      usingSingleSelectionCategory, usingSingleSelectionSubject, usingSingleSelectionModel,
    });
    IModelApp.features.track(HideIsolateEmphasizeAction.IsolateSelectedElements);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /**
   * Isolate model from selected elements
   * @param vp Viewport to affect
   */
  public async isolateSelectedElementsModel(vp: Viewport) {
    const modelsToKeep = new Set(await this.getSelectionSetElementModels(vp.iModel));
    await vp.replaceViewedModels(modelsToKeep);

    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({ viewport: vp, action: HideIsolateEmphasizeAction.IsolateSelectedModels });
    IModelApp.features.track(HideIsolateEmphasizeAction.IsolateSelectedModels);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /**
   * Isolate the selected category found in SelectionSet elements
   * @param vp Viewport to affect
   */
  public async isolateSelectedElementsCategory(vp: Viewport) {
    const categoriesToKeep = new Set(await this.getSelectionSetElementCategories(vp.iModel));
    const categoriesToTurnOff = [...vp.view.categorySelector.categories].filter((categoryId: string) => !categoriesToKeep.has(categoryId));
    vp.changeCategoryDisplay(categoriesToTurnOff, false);
    vp.changeCategoryDisplay(categoriesToKeep, true);

    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({ viewport: vp, action: HideIsolateEmphasizeAction.IsolateSelectedCategories });
    IModelApp.features.track(HideIsolateEmphasizeAction.IsolateSelectedCategories);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /**
   * Hide either based on Presentation selection, if defined, else the selected graphic elements
   * @param vp Viewport to affect
   */
  public async hideCommand(vp: Viewport) {
    let usingSingleSelectionCategory: string | undefined;
    let usingSingleSelectionSubject: string | undefined;
    let usingSingleSelectionModel: string | undefined;

    if (this.categorySelected()) {
      usingSingleSelectionCategory = HideIsolateEmphasizeManager._categoryClassName;
      this.hideSelectedCategory(vp);
      return;
    } else if (this.modelSelected()) {
      usingSingleSelectionModel = HideIsolateEmphasizeManager._modelClassName;
      this.hideSelectedModel(vp);
      return;
    } else if (this.subjectSelected()) {
      usingSingleSelectionSubject = HideIsolateEmphasizeManager._subjectClassName;
      await this.hideSelectedSubject(vp);
      return;
    }

    EmphasizeElements.getOrCreate(vp).hideSelectedElements(vp); // Hide selected elements
    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({
      viewport: vp, action: HideIsolateEmphasizeAction.HideSelected,
      usingSingleSelectionCategory, usingSingleSelectionSubject, usingSingleSelectionModel,
    });

    IModelApp.features.track(HideIsolateEmphasizeAction.HideSelected);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /**
   * Hide the models defined by the elements in the current SelectionSet
   * @param vp Viewport to affect
   */
  public async hideSelectedElementsModel(vp: Viewport) {
    const modelIds = await this.getSelectionSetElementModels(vp.iModel);
    vp.changeModelDisplay(modelIds, false);
    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({ viewport: vp, action: HideIsolateEmphasizeAction.HideSelectedModels });
    IModelApp.features.track(HideIsolateEmphasizeAction.HideSelectedModels);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /**
   * Hide the categories defined by the elements in the current SelectionSet
   * @param vp Viewport to affect
   */
  public async hideSelectedElementsCategory(vp: Viewport) {
    const categoryIds = await this.getSelectionSetElementCategories(vp.iModel);
    vp.changeCategoryDisplay(categoryIds, false);
    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({ viewport: vp, action: HideIsolateEmphasizeAction.HideSelectedCategories });
    IModelApp.features.track(HideIsolateEmphasizeAction.HideSelectedCategories);
    SyncUiEventDispatcher.dispatchSyncUiEvent(HideIsolateEmphasizeActionHandler.hideIsolateEmphasizeUiSyncId);
  }

  /** Checks to see if any featureOverrideProviders are active */
  public areFeatureOverridesActive(vp: Viewport): boolean {
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

  /**
   * Function that is run when `IsolateSelectedElementsModel` tool button is pressed
   */
  public async processIsolateSelectedElementsModel(): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;

    await this.isolateSelectedElementsModel(vp);
  }

  /**
   * Function that is run when `IsolateSelectedElementsCategory` tool button is pressed
   */
  public async processIsolateSelectedElementsCategory(): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;

    await this.isolateSelectedElementsCategory(vp);
  }

  /**
   * Function that is run when `IsolateSelected` tool button is pressed
   */
  public async processIsolateSelected(): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;
    this.isolateSelected(vp);
  }

  /**
   * Function that is run when `HideSelectedElementsModel` tool button is pressed
   */
  public async processHideSelectedElementsModel(): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;

    await this.hideSelectedElementsModel(vp);
  }

  /**
   * Function that is run when `HideSelectedElementsCategory` tool button is pressed
   */
  public async processHideSelectedElementsCategory(): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;

    await this.hideSelectedElementsCategory(vp);
  }

  /**
   * Function that is run when `HideSelected` tool button is pressed
   */
  public async processHideSelected(): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;

    this.hideSelected(vp);
  }

  /**
   * Function that is run when `EmphasizeSelected` tool button is pressed
   */
  public async processEmphasizeSelected(): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;

    await this.emphasizeSelected(vp);
  }

  /**
   * Function that is run when `ClearEmphasize` tool button is pressed
   */
  public async processClearEmphasize(): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;
    this.clearEmphasize(vp);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String, BeEvent, Id64Array, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { IModelApp, ViewState, ViewState2d, SpatialViewState } from "@bentley/imodeljs-frontend";
import { UiFramework } from "@bentley/ui-framework";
import { IModelError } from "@bentley/imodeljs-common";
import { ErrorHandling } from "./ErrorHandling";

export const iModelInfoAvailableEvent = new BeEvent();

interface NameAndId {
  name: string;
  id: Id64String;
}

class NamedElementCache {
  public cache: NameAndId[] = [];

  constructor(ids: Id64Array) {
    ids.forEach((id) => this.cache.push({ name: "?", id }));
  }

  protected get nameSelectWhereClause(): string {
    const a = this.cache.map((nid) => nid.id);
    return `where ecinstanceid in (${a.join(",")})`;
  }

  public clear() {
    this.cache = [];
  }

  public getNameFromId(id: Id64String): string | undefined {
    const found = this.cache.find((nid) => nid.id === id);
    return found ? found.name : undefined;
  }

  public getIdFromName(name: string): Id64String | undefined {
    const found = this.cache.find((nid) => nid.name === name);
    return found ? found.id : undefined;
  }
}

export class PhysicalModelNameCache extends NamedElementCache {
  public async findAll() {
    const wh = this.nameSelectWhereClause;
    this.cache = [];
    for await (const result of UiFramework.getIModelConnection()!.query("select ecinstanceid as id, codevalue as name from bis.PhysicalPartition " + wh)) {
      this.cache.push({ id: result.id, name: result.name });
    }
    iModelInfoAvailableEvent.raiseEvent();
  }
}

export class SpatialCategoryNameCache extends NamedElementCache {

  public async findAll() {
    const wh = this.nameSelectWhereClause;
    this.cache = [];
    for await (const result of UiFramework.getIModelConnection()!.query("select ecinstanceid as id, codevalue as name from bis.SpatialCategory " + wh)) {
      this.cache.push({ id: result.id, name: result.name });
    }
    iModelInfoAvailableEvent.raiseEvent();
  }
}

export class ActiveSettingsManager {
  public static categories: SpatialCategoryNameCache;
  public static models: PhysicalModelNameCache;

  public static onViewOpened(view: ViewState) {
    this.computeActiveSettingsFromView(view);

    IModelApp.viewManager.onSelectedViewportChanged.addListener((args) => {
      const vp = args.current;
      if (!vp)
        return;

      this.computeActiveSettingsFromView(vp.view);

      vp.onViewedCategoriesChanged.addListener(() => this.computeActiveSettingsFromView(vp.view));
      vp.onViewedModelsChanged.addListener(() => this.computeActiveSettingsFromView(vp.view));
    });
  }

  private static computeActiveSettingsFromView(view: ViewState) {
    const promises = [this._computeCategoriesOnViewChanged(view), this._computeModelsOnViewChanged(view)];
    Promise.all(promises)
      .then(() => iModelInfoAvailableEvent.raiseEvent())
      .catch((err: Error) => ErrorHandling.onUnexpectedError(err));
  }

  private static async _computeCategoriesOnViewChanged(view: ViewState) {

    const categories = Array.from(view.categorySelector.categories);

    this.categories = new SpatialCategoryNameCache(categories);

    if (!IModelApp.toolAdmin.activeSettings.category || !this.categories.getNameFromId(IModelApp.toolAdmin.activeSettings.category))
      IModelApp.toolAdmin.activeSettings.category = (categories.length !== 0) ? categories[0] : undefined;

    return this.categories.findAll();
  }

  private static async _computeModelsOnViewChanged(view: ViewState) {
    let models: Id64Array;
    if (view instanceof ViewState2d)
      models = [view.baseModelId];
    else if (view instanceof SpatialViewState)
      models = Array.from(view.modelSelector.models);
    else {
      throw new IModelError(IModelStatus.BadArg, "only 2d and spatial views are supported", Logger.logError, "simple-editor-app", () => view);
    }

    this.models = new PhysicalModelNameCache(models);

    if (!IModelApp.toolAdmin.activeSettings.model || !this.models.getNameFromId(IModelApp.toolAdmin.activeSettings.model))
      IModelApp.toolAdmin.activeSettings.model = (models.length !== 0) ? models[0] : undefined;

    return this.models.findAll();
  }

  public static onModelCreated(id: Id64String, name: string, makeActive: boolean) {
    this.models.cache.push({ id, name });
    if (makeActive)
      IModelApp.toolAdmin.activeSettings.model = id;
    iModelInfoAvailableEvent.raiseEvent();
  }

  // private static async onIModelClose() {
  //   this.categories.clear();
  //   this.models.clear();
  // }
}

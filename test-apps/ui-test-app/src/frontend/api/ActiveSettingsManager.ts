/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiFramework } from "@itwin/appui-react";
import { BeEvent, Id64Array, Id64String, IModelStatus } from "@itwin/core-bentley";
import { IModelError, QueryRowFormat } from "@itwin/core-common";
import { IModelApp, SpatialViewState, ViewState, ViewState2d } from "@itwin/core-frontend";
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

export class ModelNameCache extends NamedElementCache {
  public async findAll() {
    const wh = this.nameSelectWhereClause;
    this.cache = [];
    for await (const result of UiFramework.getIModelConnection()!.query(`select ecinstanceid as id, codevalue as name from bis.InformationPartitionElement ${wh}`, undefined, QueryRowFormat.UseJsPropertyNames)) {
      this.cache.push({ id: result.id, name: result.name });
    }
    iModelInfoAvailableEvent.raiseEvent();
  }
}

export class CategoryNameCache extends NamedElementCache {

  public async findAll() {
    const wh = this.nameSelectWhereClause;
    this.cache = [];
    for await (const result of UiFramework.getIModelConnection()!.query(`select ecinstanceid as id, codevalue as name from bis.Category ${wh}`, undefined, QueryRowFormat.UseJsPropertyNames)) {
      this.cache.push({ id: result.id, name: result.name });
    }
    iModelInfoAvailableEvent.raiseEvent();
  }
}

export class ActiveSettingsManager {
  public static categories: CategoryNameCache;
  public static models: ModelNameCache;

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

    if (categories.length === 0) {
      // new categories are turned on. What to do? Just leave the active settings as they are.
      return;
    }

    this.categories = new CategoryNameCache(categories);

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
      throw new IModelError(IModelStatus.BadArg, "only 2d and spatial views are supported");
    }

    if (models.length === 0) {
      // new models are turned on. What to do? Just leave the active settings as they are.
      return;
    }

    this.models = new ModelNameCache(models);

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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String, BeEvent } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { AppState } from "../api/AppState";
import { ErrorHandling } from "../api/ErrorHandling";

const iModelInfoAvailableEvent = new BeEvent();

interface NameAndId {
  name: string;
  id: Id64String;
}

class NamedElementCache {
  public cache: NameAndId[] = [];

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
    this.cache = [];
    for await (const result of AppState.iModelConnection.query("select ecinstanceid as id, codevalue as name from bis.PhysicalPartition")) {
      this.cache.push({ id: result.id, name: result.name });
    }
    if (this.cache.length !== 0)
      IModelApp.toolAdmin.activeSettings.model = this.cache[0].id;
    else
      IModelApp.toolAdmin.activeSettings.model = "";

    iModelInfoAvailableEvent.raiseEvent();
  }
}

export class SpatialCategoryNameCache extends NamedElementCache {
  public async findAll() {
    this.cache = [];
    for await (const result of AppState.iModelConnection.query("select ecinstanceid as id, codevalue as name from bis.SpatialCategory")) {
      this.cache.push({ id: result.id, name: result.name });
    }
    if (this.cache.length !== 0)
      IModelApp.toolAdmin.activeSettings.category = this.cache[0].id;
    else
      IModelApp.toolAdmin.activeSettings.category = "";

    iModelInfoAvailableEvent.raiseEvent();
  }
}

export class ActiveSettingsManager {
  public static categories: SpatialCategoryNameCache;
  public static models: PhysicalModelNameCache;

  public static initialize() {
    AppState.onIModelOpened.addListener(this.onIModelOpened, this);
    AppState.onIModelClose.addListener(this.onIModelClose, this);
    if (AppState.isOpen)
      this.onIModelOpened().catch((err) => ErrorHandling.onUnexpectedError(err));
  }

  public static async onIModelOpened() {
    this.categories = new SpatialCategoryNameCache();
    this.categories.findAll().catch((err) => ErrorHandling.onUnexpectedError(err));
    this.models = new PhysicalModelNameCache();
    this.models.findAll().catch((err) => ErrorHandling.onUnexpectedError(err));
  }

  private static async onIModelClose() {
    this.categories.clear();
    this.models.clear();
  }
}

interface ActiveSettingsComponentState {
  foo: number;
}

export class ActiveSettingsComponent extends React.Component<{}, ActiveSettingsComponentState> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { foo: 0 };
    iModelInfoAvailableEvent.addListener(this.reRender, this);
    ActiveSettingsManager.initialize();
  }

  private reRender() { this.setState((prev) => ({ ...prev, foo: prev.foo + 1 })); }

  private get activeModelName(): string {
    if (IModelApp.toolAdmin.activeSettings.model === undefined)
      return "";
    return ActiveSettingsManager.models.getNameFromId(IModelApp.toolAdmin.activeSettings.model) || "";
  }

  private get activeCategoryName(): string {
    if (IModelApp.toolAdmin.activeSettings.category === undefined)
      return "";
    return ActiveSettingsManager.categories.getNameFromId(IModelApp.toolAdmin.activeSettings.category) || "";
  }

  private getAllModels(): JSX.Element[] {
    // TODO: Include only a) models in the current view and b) models that are writable (i.e., not ownded by a bridge)
    return ActiveSettingsManager.models.cache.map((nid) =>
      <option key={nid.name}>{nid.name}</option>,
    );
  }

  private onSelectModel(event: React.FormEvent<HTMLSelectElement>) {
    const nid = ActiveSettingsManager.models.cache[event.currentTarget.selectedIndex];
    IModelApp.toolAdmin.activeSettings.model = nid.id;
    this.reRender();
  }

  private getAllCategories(): JSX.Element[] {
    // TODO: SpatialCategories for spatial views; DrawingCategories for drawing views.
    return ActiveSettingsManager.categories.cache.map((nid) =>
      <option key={nid.name}>{nid.name}</option>,
    );
  }

  private onSelectCategory(event: React.FormEvent<HTMLSelectElement>) {
    const nid = ActiveSettingsManager.categories.cache[event.currentTarget.selectedIndex];
    IModelApp.toolAdmin.activeSettings.category = nid.id;
    this.reRender();
  }

  public render() {
    if (ActiveSettingsManager.models === undefined || ActiveSettingsManager.categories === undefined)
      return <div>...</div>;
    return (
      <div className="activeSettings">
        <span>Model: </span><select title="Active Model" id="activeSettings-model" value={this.activeModelName} onChange={(e) => this.onSelectModel(e)} >
          {this.getAllModels()}
        </select>
        <span>  </span>
        <span>Category: </span><select title="Active Category" id="activeSettings-category" value={this.activeCategoryName} onChange={(e) => this.onSelectCategory(e)} >
          {this.getAllCategories()}
        </select>
      </div>
    );
  }

}

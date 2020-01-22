/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Field } from "@bentley/presentation-common";
import { BeEvent } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { IFavoritePropertiesStorage, IModelAppFavoritePropertiesStorage } from "./FavoritePropertiesStorage";

/**
 * Holds the information of favorite properties.
 * @internal
 */
export interface FavoriteProperties {
  /** Format: {content class schema name}:{content class name} */
  nestedContentInfos: Set<string>;
  /** Format: {schema name}:{class name}:{property name}. */
  propertyInfos: Set<string>;
  /** Format: {field name}. */
  baseFieldInfos: Set<string>;
}

/** @beta */
export interface FavoritePropertiesManagerProps {
  /** @internal */
  storage?: IFavoritePropertiesStorage;
}

/**
 * The favorite property manager which lets to store favorite properties
 * and check if field contains favorite properties.
 *
 * @beta
 */
export class FavoritePropertiesManager {
  /** Event raised after favorite properties have changed. */
  public onFavoritesChanged = new BeEvent<() => void>();

  private _storage: IFavoritePropertiesStorage;
  private _globalProperties: FavoriteProperties | undefined;
  private _projectProperties: Map<string, FavoriteProperties>;
  private _imodelProperties: Map<string, FavoriteProperties>;

  public constructor(props?: FavoritePropertiesManagerProps) {
    this._storage = (props && props.storage) ? props.storage : new IModelAppFavoritePropertiesStorage();

    this._projectProperties = new Map<string, FavoriteProperties>();
    this._imodelProperties = new Map<string, FavoriteProperties>();
  }

  /**
   * Initialize favorite properties for the provided IModelConnection.
   * @internal
   */
  public initializeConnection = async (imodelConnection: IModelConnection) => {
    const imodelId = imodelConnection.iModelToken.iModelId;
    const projectId = imodelConnection.iModelToken.contextId;

    if (this._globalProperties === undefined)
      this._globalProperties = await this._storage.loadProperties() || getEmptyFavoriteProperties();

    if (imodelId === undefined || this._imodelProperties.has(getiModelInfo(projectId, imodelId)))
      return;
    const imodelProperties = await this._storage.loadProperties(projectId, imodelId) || getEmptyFavoriteProperties();
    this._imodelProperties.set(getiModelInfo(projectId, imodelId), imodelProperties);

    if (projectId === undefined || this._projectProperties.has(projectId))
      return;
    const projectProperties = await this._storage.loadProperties(projectId) || getEmptyFavoriteProperties();
    this._projectProperties.set(projectId, projectProperties);
  }

  private validateInitializedScope(projectId?: string, imodelId?: string) {
    if (this._globalProperties === undefined)
      throw Error("Favorite properties are not initialized. Call initializeConnection() with an IModelConnection to initialize.");
    if (projectId && !this._projectProperties.has(projectId))
      throw Error(`Favorite properties are not initialized for project: ${projectId}.`);
    if (imodelId && !this._imodelProperties.has(getiModelInfo(projectId, imodelId)))
      throw Error(`Favorite properties are not initialized for iModel: ${imodelId}. In project: ${projectId}.`);
  }

  /**
   * Adds favorite properties into a certain scope.
   * @param field Field that contains properties. If field contains multiple properties, all of them will be favorited.
   * @param projectId Project Id, if the favorite property is specific to a project, otherwise undefined.
   * @param imodelId iModel Id, if the favorite property is specific to a iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   */
  public async add(field: Field, projectId?: string, imodelId?: string): Promise<void> {
    this.validateInitializedScope(projectId, imodelId);

    const fieldInfos = this.getFieldInfos(field);
    const favoriteProperties: FavoriteProperties =
      imodelId ? this._imodelProperties.get(getiModelInfo(projectId, imodelId))! :
        projectId ? this._projectProperties.get(projectId)! :
          this._globalProperties!;

    const countBefore = count(favoriteProperties);
    add(favoriteProperties, fieldInfos);
    if (count(favoriteProperties) !== countBefore) {
      await this._storage.saveProperties(favoriteProperties, projectId, imodelId);
      this.onFavoritesChanged.raiseEvent();
    }
  }

  /**
   * Removes favorite properties from scopes that there is info about.
   * @param field Field that contains properties. If field contains multiple properties, all of them will be un-favorited.
   * @param projectId Project Id to additionaly remove favorite properties from project scope, otherwise undefined.
   * @param imodelId iModel Id to additionaly remove favorite properties from iModel scope, otherwise undefined. The projectId must be specified if iModelId is specified.
   */
  public async remove(field: Field, projectId?: string, imodelId?: string): Promise<void> {
    this.validateInitializedScope(projectId, imodelId);

    const fieldInfos = this.getFieldInfos(field);
    const scopes: Array<{ properties: FavoriteProperties, save: (properties: FavoriteProperties) => Promise<void> }> = [];
    scopes.push({
      properties: this._globalProperties!,
      save: (properties) => this._storage.saveProperties(properties),
    });
    if (projectId !== undefined) {
      scopes.push({
        properties: this._projectProperties.get(projectId)!,
        save: (properties) => this._storage.saveProperties(properties, projectId),
      });
    }
    if (imodelId !== undefined) {
      scopes.push({
        properties: this._imodelProperties.get(getiModelInfo(projectId!, imodelId))!,
        save: (properties) => this._storage.saveProperties(properties, projectId, imodelId),
      });
    }

    const saves: Array<Promise<void>> = [];
    let favoritesChanged = false;
    for (const scope of scopes) {
      const { properties, save } = scope;
      const countBefore = count(properties);
      remove(properties, fieldInfos);
      if (count(properties) !== countBefore) {
        saves.push(save(properties));
        favoritesChanged = true;
      }
    }
    await Promise.all(saves);
    if (favoritesChanged)
      this.onFavoritesChanged.raiseEvent();
  }

  /**
   * Removes all favorite properties from a certain scope.
   * @param projectId Project Id, if the favorite property is specific to a project, otherwise undefined.
   * @param imodelId iModel Id, if the favorite property is specific to a iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   */
  public async clear(projectId?: string, imodelId?: string): Promise<void> {
    this.validateInitializedScope(projectId, imodelId);

    const favoriteProperties: FavoriteProperties =
      imodelId ? this._imodelProperties.get(getiModelInfo(projectId, imodelId))! :
        projectId ? this._projectProperties.get(projectId)! :
          this._globalProperties!;

    const countBefore = count(favoriteProperties);
    clear(favoriteProperties);
    if (count(favoriteProperties) !== countBefore) {
      await this._storage.saveProperties(favoriteProperties, projectId, imodelId);
      this.onFavoritesChanged.raiseEvent();
    }
  }

  /**
   * Check if field contains at least one favorite property.
   * @param field Field that contains properties.
   * @param projectId Project Id, to additionally include the project favorite properties, otherwise undefined - only global favorite properties are taken into account.
   * @param imodelId iModel Id, to additionally include the iModel favorite properties, otherwise undefined. The projectId must be specified if iModelId is specified.
   */
  public has(field: Field, projectId?: string, imodelId?: string): boolean {
    this.validateInitializedScope(projectId, imodelId);

    const fieldInfos = this.getFieldInfos(field);
    return hasAny(this._globalProperties!, fieldInfos) ||
      (projectId !== undefined && hasAny(this._projectProperties.get(projectId)!, fieldInfos)) ||
      (imodelId !== undefined && hasAny(this._imodelProperties.get(getiModelInfo(projectId!, imodelId))!, fieldInfos));
  }

  private getFieldInfos(field: Field): FavoriteProperties {
    const nestedContentInfos = new Set<string>();
    const propertyInfos = new Set<string>();
    const baseFieldInfos = new Set<string>();
    if (field.isNestedContentField()) {
      nestedContentInfos.add(field.contentClassInfo.name);
    } else if (field.isPropertiesField()) {
      const prefix = getNestingPrefix(field);
      for (const property of field.properties)
        propertyInfos.add(`${prefix}${property.property.classInfo.name}:${property.property.name}`);
    } else {
      baseFieldInfos.add(field.name);
    }
    return { nestedContentInfos, propertyInfos, baseFieldInfos };
  }
}

const getNestingPrefix = (field: Field) => {
  let path = new Array<string>();
  let curr = field.parent;
  while (curr) {
    path = [...curr.pathToPrimaryClass.map((rel) => `${rel.isForwardRelationship ? "F" : "B"}:${rel.relationshipInfo.name}`), ...path];
    curr = curr.parent;
  }
  if (path.length) {
    // push an empty string so we get a '-' suffix
    path.push("");
  }
  return path.join("-");
};

const getiModelInfo = (projectId: string | undefined, imodelId: string) => projectId + "/" + imodelId;

const getEmptyFavoriteProperties = () => ({
  nestedContentInfos: new Set<string>(),
  propertyInfos: new Set<string>(),
  baseFieldInfos: new Set<string>(),
});

const count = (favorites: FavoriteProperties) => {
  return favorites.baseFieldInfos.size + favorites.nestedContentInfos.size + favorites.propertyInfos.size;
};

const add = (dest: FavoriteProperties, source: FavoriteProperties) => {
  source.nestedContentInfos.forEach((info) => dest.nestedContentInfos.add(info));
  source.propertyInfos.forEach((info) => dest.propertyInfos.add(info));
  source.baseFieldInfos.forEach((info) => dest.baseFieldInfos.add(info));
};

const remove = (container: FavoriteProperties, toRemove: FavoriteProperties) => {
  toRemove.nestedContentInfos.forEach((info) => container.nestedContentInfos.delete(info));
  toRemove.propertyInfos.forEach((info) => container.propertyInfos.delete(info));
  toRemove.baseFieldInfos.forEach((info) => container.baseFieldInfos.delete(info));
};

const clear = (container: FavoriteProperties) => {
  container.nestedContentInfos.clear();
  container.propertyInfos.clear();
  container.baseFieldInfos.clear();
};

const setHasAny = (set: Set<string>, lookup: Set<string>) => {
  for (const key of lookup) {
    if (set.has(key))
      return true;
  }
  return false;
};

const hasAny = (container: FavoriteProperties, lookup: FavoriteProperties) => {
  return setHasAny(container.nestedContentInfos, lookup.nestedContentInfos)
    || setHasAny(container.propertyInfos, lookup.propertyInfos)
    || setHasAny(container.baseFieldInfos, lookup.baseFieldInfos);
};

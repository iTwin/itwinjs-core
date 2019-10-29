/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Field } from "@bentley/presentation-common";
import { BeEvent } from "@bentley/bentleyjs-core";

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

/**
 * The favorite property manager which lets to store favorite properties
 * and check if field contains favorite properties.
 *
 * @beta
 */
export class FavoritePropertyManager {
  private _favoriteProperties: FavoriteProperties;

  /** Event raised after favorite properties have changed. */
  public onFavoritesChanged = new BeEvent<() => void>();

  public constructor() {
    this._favoriteProperties = {
      nestedContentInfos: new Set(),
      propertyInfos: new Set(),
      baseFieldInfos: new Set(),
    };
  }

  /**
   * Adds favorite properties.
   * If field contains multiple properties, all of them will be favorited.
   */
  public add(field: Field): void {
    const fieldInfos = this.getFieldInfos(field);
    const countBefore = count(this._favoriteProperties);
    add(this._favoriteProperties, fieldInfos);
    if (count(this._favoriteProperties) !== countBefore)
      this.onFavoritesChanged.raiseEvent();
  }

  /**
   * Removes favorite properties.
   * If field contains multiple properties, all of them will be un-favorited.
   */
  public remove(field: Field): void {
    const fieldInfos = this.getFieldInfos(field);
    const countBefore = count(this._favoriteProperties);
    remove(this._favoriteProperties, fieldInfos);
    if (count(this._favoriteProperties) !== countBefore)
      this.onFavoritesChanged.raiseEvent();
  }

  /**
   * Check if field contains at least one favorite property.
   */
  public has(field: Field): boolean {
    const fieldInfos = this.getFieldInfos(field);
    return hasAny(this._favoriteProperties, fieldInfos);
  }

  private getFieldInfos(field: Field): FavoriteProperties {
    const nestedContentInfos = new Set<string>();
    const propertyInfos = new Set<string>();
    const baseFieldInfos = new Set<string>();
    if (field.isNestedContentField()) {
      nestedContentInfos.add(field.contentClassInfo.name);
    } else if (field.isPropertiesField()) {
      for (const property of field.properties)
        propertyInfos.add(`${property.property.classInfo.name}:${property.property.name}`);
    } else {
      baseFieldInfos.add(field.name);
    }
    return { nestedContentInfos, propertyInfos, baseFieldInfos };
  }
}

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

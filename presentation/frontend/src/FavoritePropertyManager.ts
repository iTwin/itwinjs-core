/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Field } from "@bentley/presentation-common";
import { BeEvent } from "@bentley/bentleyjs-core";

/**
 * The favorite property manager which lets to store favorite properties
 * and check if field contains favorite properties.
 *
 * @beta
 */
export class FavoritePropertyManager {
  /** Event raised after favorite properties have changed. */
  public onFavoritesChanged = new BeEvent<() => void>();
  // contains strings with format: {schema}:{class}:{property}
  private _favoritePropertyInfos = new Set<string>();
  // contains strings with format: {class name (if class exists)}:{field name}
  private _favoriteBaseFieldInfos = new Set<string>();

  /**
   * Adds favorite properties.
   * If field contains multiple properties, all of them will be favorited.
   */
  public add(field: Field): void {
    const fieldInfos = this.getFieldInfos(field);
    const countBefore = this._favoritePropertyInfos.size + this._favoriteBaseFieldInfos.size;

    fieldInfos.propertyInfos.forEach((info) => this._favoritePropertyInfos.add(info));
    fieldInfos.baseFieldInfos.forEach((info) => this._favoriteBaseFieldInfos.add(info));

    if (this._favoritePropertyInfos.size + this._favoriteBaseFieldInfos.size !== countBefore)
      this.onFavoritesChanged.raiseEvent();
  }

  /**
   * Removes favorite properties.
   * If field contains multiple properties, all of them will be un-favorited.
   */
  public remove(field: Field): void {
    const fieldInfos = this.getFieldInfos(field);
    const countBefore = this._favoritePropertyInfos.size + this._favoriteBaseFieldInfos.size;

    fieldInfos.propertyInfos.forEach((info) => this._favoritePropertyInfos.delete(info));
    fieldInfos.baseFieldInfos.forEach((info) => this._favoriteBaseFieldInfos.delete(info));

    if (this._favoritePropertyInfos.size + this._favoriteBaseFieldInfos.size !== countBefore)
      this.onFavoritesChanged.raiseEvent();
  }

  /**
   * Check if field contains at least one favorite property.
   */
  public has(field: Field): boolean {
    const fieldInfos = this.getFieldInfos(field);
    return fieldInfos.propertyInfos.some((info) => this._favoritePropertyInfos.has(info)) ||
      fieldInfos.baseFieldInfos.some((info) => this._favoriteBaseFieldInfos.has(info));
  }

  private getFieldInfos(field: Field): { propertyInfos: string[], baseFieldInfos: string[] } {
    const propertyInfos: string[] = [];
    const baseFieldInfos: string[] = [];
    if (field.isNestedContentField()) {
      for (const nestedField of field.nestedFields) {
        const nestedFieldInfos = this.getFieldInfos(nestedField);
        propertyInfos.push(...nestedFieldInfos.propertyInfos);
        baseFieldInfos.push(...nestedFieldInfos.baseFieldInfos);
      }
    } else if (field.isPropertiesField()) {
      for (const property of field.properties)
        propertyInfos.push(`${property.property.classInfo.name}:${property.property.name}`);
    } else {
      const baseFieldInfo = `${(field.parent ? field.parent.contentClassInfo.name + ":" : "")}${field.name}`;
      baseFieldInfos.push(baseFieldInfo);
    }
    return { propertyInfos, baseFieldInfos };
  }
}

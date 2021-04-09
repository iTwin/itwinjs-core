/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { RendererDescription } from "./Renderer";

/**
 * A data structure that describes a [[Field]] category.
 * @public
 */
export interface CategoryDescription {
  /** Unique name */
  name: string;
  /** Display label */
  label: string;
  /** Extensive description */
  description: string;
  /** Priority. Categories with higher priority should appear higher in the UI */
  priority: number;
  /** Should this category be auto-expanded when it's displayed in the UI */
  expand: boolean;
  /** Parent category description */
  parent?: CategoryDescription;
  /** Custom renderer description */
  renderer?: RendererDescription;
}
/** @public */
export namespace CategoryDescription {
  /** Serialize given category to JSON */
  export function toJSON(category: CategoryDescription): CategoryDescriptionJSON {
    return {
      ...category,
      parent: category.parent?.name,
    };
  }

  /**
   * Deserialize [[CategoryDescription]] from JSON. The `parent` is not assigned - use listFromJSON
   * to deserialize the whole categories list and set parents.
   */
  export function fromJSON(json: CategoryDescriptionJSON): CategoryDescription {
    return {
      ...json,
      parent: undefined,
    };
  }

  function createCategoriesHierarchy(json: CategoryDescriptionJSON, categoriesMap: Map<string, CategoryDescription>): CategoryDescription {
    const category = categoriesMap.get(json.name)!;
    if (json.parent) {
      // note: mutating categories in the `categoriesMap`
      category.parent = categoriesMap.get(json.parent);
    }
    return category;
  }

  /** Deserialize a list of [[CategoryDescription]] from JSON. */
  export function listFromJSON(json: CategoryDescriptionJSON[]): CategoryDescription[] {
    const categoriesMap = new Map<string, CategoryDescription>();
    json.forEach((categoryJson) => categoriesMap.set(categoryJson.name, { ...categoryJson, parent: undefined }));
    return json.map((categoryJson) => createCategoriesHierarchy(categoryJson, categoriesMap));
  }
}

/**
 * Serialized [[CategoryDescription]] JSON representation.
 * @public
 */
export interface CategoryDescriptionJSON {
  name: string;
  label: string;
  description: string;
  priority: number;
  expand: boolean;
  parent?: string;
  renderer?: RendererDescription;
}

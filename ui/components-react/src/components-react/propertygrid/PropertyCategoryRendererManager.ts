/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import type * as React from "react";
import type { VirtualizedPropertyGridContext } from "./component/VirtualizedPropertyGrid";
import type { GridCategoryItem } from "./internal/flat-items/FlatGridItem";

/**
 * Props that property category renderer receives.
 * @beta
 */
export interface PropertyCategoryRendererProps {
  /** The category being rendered. */
  categoryItem: GridCategoryItem;
  /** Context of the surrounding property grid. */
  gridContext: VirtualizedPropertyGridContext;
  /** Sets the allocated height for category contents. */
  onHeightChanged: (newHeight: number) => void;
}

/**
 * Factory function that produces custom property category components.
 * @beta
 */
export type PropertyCategoryRenderer = (categoryItem: GridCategoryItem) => React.ComponentType<PropertyCategoryRendererProps> | undefined;

/**
 * Keeps a record of currently registered property category renderers and determines which renderers get invoked for
 * each category.
 * @beta
 */
export class PropertyCategoryRendererManager {
  private _categoryRenderers = new Map<string, PropertyCategoryRenderer>();

  public static defaultManager = new PropertyCategoryRendererManager();

  /** Retrieves a category rendering component based for the passed category item. */
  public getCategoryComponent(categoryItem: GridCategoryItem): React.ComponentType<PropertyCategoryRendererProps> | undefined {
    if (categoryItem.derivedCategory.renderer === undefined) {
      return undefined;
    }

    return this._categoryRenderers.get(categoryItem.derivedCategory.renderer.name)?.(categoryItem);
  }

  /** Registers a renderer factory function to be invoked on categories with specific renderer name. */
  public addRenderer(rendererName: string, categoryRenderer: PropertyCategoryRenderer, override = false): void {
    if (this._categoryRenderers.has(rendererName) && !override) {
      const className = PropertyCategoryRendererManager.name;
      const methodName = PropertyCategoryRendererManager.prototype.addRenderer.name;
      throw new Error(`${className}.${methodName} error: renderer '${rendererName}' has already been added. Did you mean to override it?`);
    }

    this._categoryRenderers.set(rendererName, categoryRenderer);
  }

  /** Removes previous renderer factory registration. */
  public removeRenderer(rendererName: string): void {
    this._categoryRenderers.delete(rendererName);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { CompressedId64Set, Id64Set } from "@bentley/bentleyjs-core";

/** The [[planarClipMask]] values that describe how planar clip masks geometry are collected.
 * @see [[PlanarClipMaskProps]]
 * @see [[PlanarClipMaskSettings]]
 * @beta
 */
export enum PlanarClipMaskMode {
  /** None indicates that no masking is performed.   */
  None = 0,
  /** Priority indicates that masking should occur for all models with a higher priority.  Various model types have default priorities as enumerated in [[PlanarClipMaskModelPriority]]. As background maps have
   * lowest priority they are masked by all other model types, followed by global and nonglobal reality models.  BIM models have highest priority and are never masked.  Reality models priority can be overriden by setting
   * a value in the [[PlanarClipMask]] object to cause reality models to mask each other.  This can be useful if more than one overlapping reality model is present.
   */
  Priority = 1,
  /**  Models indicates that masking should occur by all models indicated by [[PlanarClipMaskProps.modelIds]], in this case the model does not have to be displayed in the view participate in masking.
   * if [[PlanarClipMaskProps.modelIds]] is not defined then all viewed models will mask.
   */
  Models = 2,
  /** IncludeSubCategories indicates that masks should be produced only by the subcategories included in the [[PlanarClipMaskProps.subCategoryOrElementIds]] array. */
  IncludeSubCategories = 3,
  /** IncludeElements indicates that masks should be produced only by the elements included in the [[PlanarClipMaskProps.subCategoryOrElementIds]] array.  */
  IncludeElements = 4,
  /** ExcludeElements indicates that masks should be produced only by the elements NOT included in the [[PlanarClipMaskProps.subCategoryOrElementIds]] array.  */
  ExcludeElements = 5,
}

/** The default priority values for a [[PlanrClipMask]]  models.  Models with [[PlanarClipMaskMode]] set to priority are
 * clipped by by any model with a higher priority.  The enumerated values are the defaults and may be overriden by setting
 * [[PlanarClipMask]].priority.
 * @see [[PlanarClipMaskProps]]
 * @see [[PlanarClipMaskSettings]]
 *  @beta
 */
export enum PlanarClipMaskPriority {
  BackgroundMap = -2048,
  GlobalRealityModel = -1024,
  RealityModel = 0,
  BIM = 2048,
  Maximum = 4096,
}

/** JSON representation of the [[PlanarClipMask]]  properties.
 * @beta
 */
export interface  PlanarClipMaskProps {
  /** The mode that controls how the mask geometry is collected */
  mode: PlanarClipMaskMode;
  /** The model IDs for the mask geometry.  If omitted then the models viewed in the masked model viewport are used */
  modelIds?: CompressedId64Set;
  /** The SubCategory ids if mode is [[PlanarClipMaskMode.IncludeSubCategorie]] or element Ids if mode is [[PlanarClipMaskMode.IncludeElements] or [[PlanarClipMaskMode.ExcludeElements]] */
  subCategoryOrElementIds?: CompressedId64Set;
  /** Priority value if mode is [[PlanarClipMaskMode.Priority]]. */
  priority?: number;
  /** A value between 0 and 1 indicating mask transparency - A transparency of 0 (the default) indicates complete masking.  1 is completely transparent (no masking). */
  transparency?: number;
}

/** Normalized representation of [[PlanarClipMaskProps]] with validation and default values applied.
 * @beta
 */
export class PlanarClipMaskSettings {
  /** The mode that controls how the mask geometry is collected */
  public readonly mode: PlanarClipMaskMode = PlanarClipMaskMode.None;
  /** The model IDs for the mask geometry.  If omitted then the models viewed in the masked model viewport are used */
  public readonly modelIds?: CompressedId64Set;
  /** The SubCategory ids if mode is [[PlanarClipMaskMode.IncludeSubCategorie]] or element Ids if mode is [[PlanarClipMaskMode.IncludeElements] or [[PlanarClipMaskMode.ExcludeElements]] */
  public readonly subCategoryOrElementIds?: CompressedId64Set;
  /** Priority value if mode is [[PlanarClipMaskMode.Priority]]. */
  public readonly priority?: number;
  /** A value between 0 and 1 indicating am override for mask transparency - A transparency of 0 (the default) indicates complete masking.  1 is completely transparent (no masking).  If no transparency is defined then the transparency of the mask elements are used */
  public readonly transparency?: number;

  /** Create a new [[PlanarClipMaskSettings]] object from a JSON object */
  public static fromJSON(json?: PlanarClipMaskProps): PlanarClipMaskSettings {
    if (!json)
      return this.defaults;

    return new PlanarClipMaskSettings(json.mode, json.transparency, json.modelIds, json.subCategoryOrElementIds, json.priority);
  }
  /** Create a [[PlanarClipMaskAettings]] object */
  public static create(mode: PlanarClipMaskMode, modelIds?: Id64Set, subCategoryOrElementIds?: Id64Set, transparency?: number): PlanarClipMaskSettings | undefined {
    switch (mode) {
      case PlanarClipMaskMode.None:
      case PlanarClipMaskMode.Priority:
        return new PlanarClipMaskSettings(mode);

      case PlanarClipMaskMode.Models:
        return modelIds === undefined ? undefined : new PlanarClipMaskSettings(mode, transparency, CompressedId64Set.compressSet(modelIds));

      case PlanarClipMaskMode.IncludeSubCategories:
      case PlanarClipMaskMode.IncludeElements:
      case PlanarClipMaskMode.ExcludeElements:
        return subCategoryOrElementIds === undefined ? undefined : new PlanarClipMaskSettings(mode, transparency, modelIds ? CompressedId64Set.compressSet(modelIds) : undefined, CompressedId64Set.compressSet(subCategoryOrElementIds));

      default:
        return undefined;
    }
  }

  /** Create [[planarClipMaskSettings]] object by priority
   * @see [[PlanarClipMaskPriority]]
   */
  public static createByPriority(priority: number, transparency?: number) {
    return new PlanarClipMaskSettings(PlanarClipMaskMode.Priority, transparency, undefined, undefined, priority);
  }

  /** Create JSON object representing this [[PlanarClipMaskSettings]] */
  public toJSON(): PlanarClipMaskProps {
    return { mode: this.mode, modelIds: this.modelIds, subCategoryOrElementIds: this.subCategoryOrElementIds, priority: this.priority, transparency: this.transparency  };
  }

  /**  */
  public get isValid(): boolean { return this.mode !== PlanarClipMaskMode.None; }

  public equals(other: PlanarClipMaskSettings): boolean {
    return this.mode === other.mode &&
      this.priority === other.priority &&
      this.transparency === other.transparency &&
      this.modelIds === other.modelIds  &&
      this.subCategoryOrElementIds ===  other.subCategoryOrElementIds;
  }
  /** Create a copy of this TerrainSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A TerrainSettings with all of its properties set to match those of`this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps?: PlanarClipMaskProps): PlanarClipMaskSettings {
    if (undefined === changedProps)
      return this;

    const props = {
      mode: changedProps.mode ?? this.mode,
      transparency: changedProps.transparency ?? this.transparency,
      modelIds: changedProps.modelIds ?? this.modelIds,
      subCategoryOrElementIds: changedProps.subCategoryOrElementIds ?? this.subCategoryOrElementIds,
      priority: changedProps.priority ?? this.priority,
    };

    return PlanarClipMaskSettings.fromJSON(props);
  }

  private constructor(mode: PlanarClipMaskMode, transparency?: number, modelIds?: CompressedId64Set, subCategoryOrElementIds?: CompressedId64Set, priority?: number) {
    this.mode = mode;
    this.modelIds = modelIds;
    this.subCategoryOrElementIds = subCategoryOrElementIds;
    this.priority = priority;
    this.transparency = transparency;
  }
  /** A default PlanarClipMask which masks nothing. */
  public static defaults = new PlanarClipMaskSettings(PlanarClipMaskMode.None);
}


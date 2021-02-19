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
  /** No masking. */
  None = 0,

  /** Mask based on priority. Different types of models have different default priorities as enumerated by [[PlanarClipMaskPriority]].
   * For example, background maps have the lowest prioority, so they are masked by all other types, while design ("BIM") models have the highest priority and are therefore never masked.
   * The priority of a reality model can be overridden by [[PlanarClipMaskSettings.priority]]. This is useful to allow one reality model to mask another overlapping one.
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

/** The default priority values for a [[PlanarClipMaskSettings]], based on model type. Models with a lower priority is masked by models with a higher priority
 * in [[PlanarClipMaskMode.Priority]].
 * The default can be overridden by [[PlanarClipMaskSettings.priority]].
 *  @beta
 */
export enum PlanarClipMaskPriority {
  /** Background map. */
  BackgroundMap = -2048,
  /** A reality model that spans the globe - e.g., OpenStreetMaps Buildings. */
  GlobalRealityModel = -1024,
  /** A reality model with a bounded range. */
  RealityModel = 0,
  /** A design model stored in the [IModelDb]($backend). */
  BIM = 2048,
  /** The maximum supported priority. */
  Maximum = 4096,
}

/** JSON representation of a [[PlanarClipMaskSettings]].
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

  /** Create a [[PlanarClipMaskSettings]] object */
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

  /** Create [[PlanarClipMaskSettings]] object by priority.
   * @see [[PlanarClipMaskPriority]] for default priority values based on model type.
   */
  public static createByPriority(priority: number, transparency?: number) {
    return new PlanarClipMaskSettings(PlanarClipMaskMode.Priority, transparency, undefined, undefined, priority);
  }

  /** Create JSON object representing this [[PlanarClipMaskSettings]] */
  public toJSON(): PlanarClipMaskProps {
    return { mode: this.mode, modelIds: this.modelIds, subCategoryOrElementIds: this.subCategoryOrElementIds, priority: this.priority, transparency: this.transparency  };
  }

  /** Returns true if masking is enabled. */
  public get isValid(): boolean {
    return this.mode !== PlanarClipMaskMode.None;
  }

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


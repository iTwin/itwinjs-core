/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { compareNumbersOrUndefined, compareStringsOrUndefined, CompressedId64Set, Id64Set } from "@bentley/bentleyjs-core";

/** The [[planarClipMask]] values that describe how planar clip masks geometry is collected
 * @see [[PlanarClipMaskProps]]
 * @see [[PlanarClipMaskSettings]]
 * @beta
 */
export enum PlanarClipMaskMode {
  None = 0,
  Priority = 1,
  Models = 2,
  IncludeSubCategories = 3,
  IncludeElements = 4,
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
export interface PlanarClipMaskProps {
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
  /** A value between 0 and 1 indicating mask transparency - A transparency of 0 (the default) indicates complete masking.  1 is completely transparent (no masking). */
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
      compareNumbersOrUndefined(this.priority, other.priority) === 0 &&
      compareNumbersOrUndefined(this.transparency, other.transparency) === 0 &&
      compareStringsOrUndefined(this.modelIds, other.modelIds) === 0 &&
      compareStringsOrUndefined(this.subCategoryOrElementIds, other.subCategoryOrElementIds) === 0;
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


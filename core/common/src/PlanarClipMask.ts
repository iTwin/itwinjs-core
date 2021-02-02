/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { compareNumbersOrUndefined, compareStringsOrUndefined, CompressedId64Set, Id64Set } from "@bentley/bentleyjs-core";

export enum PlanarClipMaskMode {
  None = 0,
  Priority = 1,
  Models = 2,
  IncludeSubCategories = 3,
  IncludeElements = 4,
  ExcludeSubCategories = 5,
  ExcludeElements = 6,
};

export enum PlanarClipMaskPriority {
  BackgroundMap = -2048,
  GlobalRealityModel = -1024,
  RealityModel = 0,
  BIM = 2048,
  Maximum = 4096,
};


export class PlanarClipMaskSettings {
  public readonly mode: PlanarClipMaskMode = PlanarClipMaskMode.None;
  public readonly priority?: number;
  public readonly modelIds?: CompressedId64Set;
  public readonly subCategoryOrElementIds?: CompressedId64Set;

  /** Create a new SubCategoryOverride from a JSON object */
  public static fromJSON(json?: PlanarClipMaskProps): PlanarClipMaskSettings {
    if (!json)
      return this.defaults;

    return new PlanarClipMaskSettings(json.mode, json.modelIds, json.subCategoryOrElementIds, json.priority);
  }

  public static create(mode: PlanarClipMaskMode, modelIds?: Id64Set, subCategoryOrElementIds?: Id64Set): PlanarClipMaskSettings | undefined {
    switch (mode) {
      case PlanarClipMaskMode.None:
      case PlanarClipMaskMode.Priority:
        return new PlanarClipMaskSettings(mode);

      case PlanarClipMaskMode.Models:
        return modelIds === undefined ? undefined : new PlanarClipMaskSettings(mode, CompressedId64Set.compressSet(modelIds));

      case PlanarClipMaskMode.IncludeSubCategories:
      case PlanarClipMaskMode.IncludeElements:
      case PlanarClipMaskMode.ExcludeElements:
        return subCategoryOrElementIds === undefined ? undefined : new PlanarClipMaskSettings(mode, modelIds ? CompressedId64Set.compressSet(modelIds) : undefined, CompressedId64Set.compressSet(subCategoryOrElementIds));

      default:
        return undefined;
    }
  }

  public static createByPriority(priority: number) {
    return new PlanarClipMaskSettings(PlanarClipMaskMode.Priority, undefined, undefined, priority)
  }

  public toJSON(): PlanarClipMaskProps {
    return { mode: this.mode, modelIds: this.modelIds, subCategoryOrElementIds: this.subCategoryOrElementIds, priority: this.priority };
  }

  public get anyDefined(): boolean { return this.mode !== PlanarClipMaskMode.None; }

  public equals(other: PlanarClipMaskSettings): boolean {
    return this.mode === other.mode &&
      compareNumbersOrUndefined(this.priority, other.priority) === 0 &&
      compareStringsOrUndefined(this.modelIds, other.modelIds) === 0 &&
      compareStringsOrUndefined(this.subCategoryOrElementIds, other.subCategoryOrElementIds) === 0;
  }

  private constructor(mode: PlanarClipMaskMode, modelIds?: CompressedId64Set, subCategoryOrElementIds?: CompressedId64Set, priority?: number) {
    this.mode = mode;
    this.modelIds = modelIds;
    this.subCategoryOrElementIds = subCategoryOrElementIds;
    this.priority = priority;
  }
  /** A default PlanarClipMask which masks nothing. */
  public static defaults = new PlanarClipMaskSettings(PlanarClipMaskMode.None);
}

export interface PlanarClipMaskProps {
  mode: PlanarClipMaskMode;
  modelIds?: CompressedId64Set;
  subCategoryOrElementIds?: CompressedId64Set;
  priority?: number;
}


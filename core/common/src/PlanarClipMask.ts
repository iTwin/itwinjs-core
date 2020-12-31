/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { assert, Id64Set, Id64String, JsonUtils } from "@bentley/bentleyjs-core";

export enum PlanarClipMaskMode {
  None = 0,
  HigherPriorityModels = 1,
  Models,
  Categories,
  Elements,
};
export class PlanarClipMask {
  public readonly mode: PlanarClipMaskMode = PlanarClipMaskMode.None;
  public readonly ids?: Id64Set;

  /** Create a new SubCategoryOverride from a JSON object */
  public static fromJSON(json?: PlanarClipMaskProps): PlanarClipMask {
    if (!json)
      return this.defaults;

    return new PlanarClipMask(json.mode, json.ids ? new Set<Id64String>(json.ids) : undefined);

  }
  public static create(mode: PlanarClipMaskMode, ids?: Id64Set): PlanarClipMask | undefined {
    switch (mode) {
      case PlanarClipMaskMode.None:
      case PlanarClipMaskMode.HigherPriorityModels:
        return ids === undefined ? undefined : new PlanarClipMask(mode);

      case PlanarClipMaskMode.Models:
      case PlanarClipMaskMode.Categories:
      case PlanarClipMaskMode.Elements:
        return (!ids || ids.size === 0) ? undefined : new PlanarClipMask(mode, ids);

      default:
        return undefined;
    }
  }

  public toJSON(): PlanarClipMaskProps {
    return { mode: this.mode, ids: this.ids ? Array.from(this.ids) : undefined }
  }

  public get anyDefined(): boolean { return this.mode !== PlanarClipMaskMode.None; }

  public equals(other: PlanarClipMask): boolean {
    if (this.mode !== other.mode || this.ids?.size !== other.ids?.size)
      return false;

    if (this.ids && other.ids)
      for (const id of this.ids)
        if (!other.ids.has(id))
          return false;

    return true;
  }

  private constructor(mode: PlanarClipMaskMode, ids?: Id64Set) {
    this.mode = mode;
    this.ids = ids;
  }
  /** A default PlanarClipMask which masks nothing. */
  public static defaults = new PlanarClipMask(PlanarClipMaskMode.None);
}

export interface PlanarClipMaskProps {
  mode: PlanarClipMaskMode;
  ids?: Id64String[];
}


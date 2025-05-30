/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { compareStrings, Guid, GuidString } from "@itwin/core-bentley";
import { TextureMapping } from "./TextureMapping";

/** Represents a material which can be applied to a surface to control aspects of its appearance such as color, reflectivity, texture, and so on.
 * @public
 */
export abstract class RenderMaterial {
  /** If the material originated from a Material element in the [[IModelDb]], the Id of that element. */
  public readonly key?: string;
  /** Describes how to map an image to a surface to which this material is applied. */
  public readonly textureMapping?: TextureMapping;
  /** Used for ordered comparisons, e.g. in DisplayParams.compareForMerge */
  private readonly _guid: GuidString;

  protected constructor(params: { key?: string, textureMapping?: TextureMapping }) {
    this.key = params.key;
    this.textureMapping = params.textureMapping;
    this._guid = Guid.createValue();
  }

  public get hasTexture(): boolean {
    return undefined !== this.textureMapping?.texture;
  }

  /** An [OrderedComparator]($bentley) that compares this material against `other`. */
  public compare(other: RenderMaterial): number {
    return compareStrings(this._guid, other._guid);
  }
}

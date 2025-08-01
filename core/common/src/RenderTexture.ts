/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { compareStrings, Guid, GuidString, Id64String } from "@itwin/core-bentley";

/** Identifies an image to be used to produce a [[RenderTexture]] for a given purpose - for example,
 * as part of a [[SkyBox]]. If the string is a valid `Id64String`, it refers to a persistent [Texture]($backend) element stored in an iModel.
 * Otherwise, it is interpreted as a Url resolving to an HTMLImageElement.
 * @see [[SkySphereImageProps.texture]] and [[SkyCubeImageProps]].
 * @public
 */
export type TextureImageSpec = Id64String | string;

/** Represents a texture image applied to a surface during rendering.
 * A RenderTexture is typically - but not always - associated with a [[RenderMaterial]].
 * @see [RenderSystem.createTexture]($frontend) to obtain a texture.
 * @see [RenderSystem.createTextureFromElement]($frontend) to obtain a texture from a [Texture]($backend) element.
 * @public
 */
export abstract class RenderTexture implements Disposable {
  /** Indicates the type of texture. */
  public readonly type: RenderTexture.Type;
  /** Used for ordered comparisons, e.g. in DisplayParams.compareForMerge */
  private readonly _guid: GuidString;

  public get isTileSection(): boolean { return RenderTexture.Type.TileSection === this.type; }
  public get isGlyph(): boolean { return RenderTexture.Type.Glyph === this.type; }
  public get isSkyBox(): boolean { return RenderTexture.Type.SkyBox === this.type; }
  public abstract get bytesUsed(): number;

  protected constructor(type: RenderTexture.Type) {
    this.type = type;
    this._guid = Guid.createValue();
  }

  /** Releases any WebGL resources owned by this texture.
   * For a texture created by a [RenderSystem]($frontend) for which [CreateTextureArgs.ownership]($frontend) was specified as "external",
   * the caller is responsible for invoking this method when it is finished using the texture; otherwise, the [RenderSystem]($frontend) will handle
   * its disposal.
   */
  public [Symbol.dispose]() {
    this.dispose(); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Will be made protected in a future release. Use [Symbol.dispose] instead. */
  public abstract dispose(): void; // eslint-disable-line @typescript-eslint/no-deprecated

  /** An [OrderedComparator]($bentley) that compares this texture against `other`. */
  public compare(other: RenderTexture): number {
    return compareStrings(this._guid, other._guid);
  }
}

/** @public */
export namespace RenderTexture {
  /** The types of [[RenderTexture]]s that can be created by a [RenderSystem]($frontend). */
  export enum Type {
    /** An image applied to a surface, with support for mip-mapping and repetition. */
    Normal,
    /** An image containing any number of text glyphs, used for efficiently rendering readable small text. */
    Glyph,
    /** A non-repeating image with no mip-maps, used for example for reality models. */
    TileSection,
    /** A three-dimensional texture used for rendering a skybox. */
    SkyBox,
    /** A non-repeating image with mip-maps and and anisotropic filtering, used for map tiles when draped on terrain. */
    FilteredTileSection,
    /** A gradient image used for thematic display. */
    ThematicGradient,
  }
}

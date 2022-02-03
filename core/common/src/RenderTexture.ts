/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { Id64String, IDisposable } from "@itwin/core-bentley";

/** Identifies an image to be used to produce a [[RenderTexture]] for a given purpose - for example,
 * as part of a [[SkyBox]]. If the string is a valid `Id64String`, it refers to a persistent [Texture]($backend) element stored in an iModel.
 * Otherwise, it is interpreted as a Url resolving to an HTMLImageElement.
 * @see [[SkySphereImageProps.texture]] and [[SkyCubeImageProps]].
 * @public
 */
export type TextureImageSpec = Id64String | string;

/** Represents a texture image applied to a surface during rendering.
 * A RenderTexture is typically - but not always - associated with a [[RenderMaterial]].
 * @see [RenderSystem.createTextureFromImage]($frontend) to obtain a texture from an HTML image.
 * @see [RenderSystem.createTextureFromElement]($frontend) to obtain a texture from a [Texture]($backend) element.
 * @public
 */
export abstract class RenderTexture implements IDisposable {
  /** Indicates the type of texture. */
  public readonly type: RenderTexture.Type;

  public get isTileSection(): boolean { return RenderTexture.Type.TileSection === this.type; }
  public get isGlyph(): boolean { return RenderTexture.Type.Glyph === this.type; }
  public get isSkyBox(): boolean { return RenderTexture.Type.SkyBox === this.type; }
  public abstract get bytesUsed(): number;

  protected constructor(type: RenderTexture.Type) {
    this.type = type;
  }

  /** Releases any WebGL resources owned by this texture.
   * For a texture created by a [RenderSystem]($frontend) for which [CreateTextureArgs.ownership]($frontend) was specified as "external",
   * the caller is responsible for invoking this method when it is finished using the texture; otherwise, the [RenderSystem]($frontend) will handle
   * its disposal.
   */
  public abstract dispose(): void;
}

/** @public */
export namespace RenderTexture { // eslint-disable-line no-redeclare
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

  /** Parameters used to construct a [[RenderTexture]].
   * @deprecated use RenderSystem.createTexture and TextureCreateArgs.
   * @public
   */
  export class Params {
    /** A string uniquely identifying this texture within the context of an [[IModel]]. Typically this is the element Id of the corresponding [Texture]($backend) element.
     * Textures created on the front-end generally have no key.
     */
    public readonly key?: string;
    /** Indicates the type of texture. */
    public readonly type: RenderTexture.Type;
    /** Indicates that some object is managing the lifetime of this texture and will take care of calling its dispose function appropriately.
     * An unowned texture associated with a [RenderGraphic]($frontend) will be disposed when the RenderGraphic is disposed.
     */
    public readonly isOwned: boolean;

    public constructor(key?: string, type: RenderTexture.Type = RenderTexture.Type.Normal, isOwned: boolean = false) {
      this.key = key;
      this.type = type;
      this.isOwned = isOwned;
    }

    public get isTileSection(): boolean { return RenderTexture.Type.TileSection === this.type; }
    public get isGlyph(): boolean { return RenderTexture.Type.Glyph === this.type; }
    public get isSkyBox(): boolean { return RenderTexture.Type.SkyBox === this.type; }
  }
}

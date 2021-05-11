/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IDisposable } from "@bentley/bentleyjs-core";

/** Represents a texture image applied to a surface during rendering.
 * A RenderTexture is typically - but not always - associated with a [[RenderMaterial]].
 * @see [RenderSystem.createTextureFromImage]($frontend) to obtain a texture from an HTML image.
 * @see [RenderSystem.createTextureFromElement]($frontend) to obtain a texture from a [Texture]($backend) element.
 * @public
 */
export abstract class RenderTexture implements IDisposable {
  /** A string uniquely identifying this texture within the context of an [[IModel]]. Typically this is the element Id of the corresponding [Texture]($backend).
   * Textures created on the front-end generally have no key.
   */
  public readonly key: string | undefined;
  /** Indicates the type of texture. */
  public readonly type: RenderTexture.Type;
  /** Indicates that some object is managing the lifetime of this texture and will take care of calling its dispose function appropriately.
   * An unowned texture associated with a [RenderGraphic]($frontend) will be disposed when the RenderGraphic is disposed.
   */
  public readonly isOwned: boolean;

  public get isTileSection(): boolean { return RenderTexture.Type.TileSection === this.type; }
  public get isGlyph(): boolean { return RenderTexture.Type.Glyph === this.type; }
  public get isSkyBox(): boolean { return RenderTexture.Type.SkyBox === this.type; }
  public abstract get bytesUsed(): number;

  protected constructor(params: RenderTexture.Params) {
    this.key = params.key;
    this.type = params.type;
    this.isOwned = params.isOwned;
  }

  /** Releases any WebGL resources owned by this texture.
   * If [[RenderTexture.isOwned]] is true, then whatever object claims ownership of the texture is responsible for disposing of it when it is no longer needed.
   * Otherwise, the [RenderSystem]($frontend) will handle its disposal.
   */
  public abstract dispose(): void;
}

/** @public */
export namespace RenderTexture { // eslint-disable-line no-redeclare
  /** Enumerates the types of [[RenderTexture]]s. */
  export enum Type {
    /** An image applied to a surface, with support for mip-mapping and repeating. */
    Normal,
    /** An image containing any number of text glyphs, used for efficiently rendering readable small text. */
    Glyph,
    /** A non-repeating image with no mip-maps, used for example for reality models. */
    TileSection,
    /** A three-dimensional texture used for rendering a skybox. */
    SkyBox,
    /** A non-repeating image with mip-maps and and anisotropic filtering, used for map tiles when draped on terrain. */
    FilteredTileSection,
    /** A thematic gradient image used for thematic display. */
    ThematicGradient,
  }

  /** Parameters used to construct a [[RenderTexture]]. */
  export class Params {
    /** A string uniquely identifying this texture within the context of an [[IModel]]. Typically this is the element Id of the corresponding [Texture]($backend) element.
     * Textures created on the front-end generally have no key.
     */
    public readonly key?: string;
    /** Indicates the type of texture. */
    public readonly type: Type;
    /** Indicates that some object is managing the lifetime of this texture and will take care of calling its dispose function appropriately.
     * An unowned texture associated with a [RenderGraphic]($frontend) will be disposed when the RenderGraphic is disposed.
     */
    public readonly isOwned: boolean;

    public constructor(key?: string, type: Type = Type.Normal, isOwned: boolean = false) {
      this.key = key;
      this.type = type;
      this.isOwned = isOwned;
    }

    public get isTileSection(): boolean { return Type.TileSection === this.type; }
    public get isGlyph(): boolean { return Type.Glyph === this.type; }
    public get isSkyBox(): boolean { return Type.SkyBox === this.type; }

    /** Obtain a RenderTexture params object with default values. */
    public static readonly defaults = new Params();
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */
import { RenderTexture } from "../RenderTexture.js";

/** Parameters used to construct a [[RenderTexture]] in old RenderTexture functions.
 *  Use RenderSystem.createTexture and CreateTextureArgs instead.
 *  @internal
 */
export class RenderTextureParams {
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
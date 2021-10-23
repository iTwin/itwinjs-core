/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ColorDef } from "./ColorDef";
import { TextureMapping } from "./TextureMapping";

/** Represents a material which can be applied to a surface to control aspects of its appearance such as color, reflectivity, texture, and so on.
 * @public
 */
export abstract class RenderMaterial {
  /** If the material originated from a Material element in the [[IModelDb]], the Id of that element. */
  public readonly key?: string;
  /** Describes how to map an image to a surface to which this material is applied. */
  public readonly textureMapping?: TextureMapping;

  protected constructor(params: RenderMaterial.Params) {
    this.key = params.key;
    this.textureMapping = params.textureMapping;
  }

  public get hasTexture(): boolean {
    return undefined !== this.textureMapping?.texture;
  }
}

/** @public */
export namespace RenderMaterial { // eslint-disable-line no-redeclare
  function clampToNormalizedRange(value: number): number {
    return Math.max(0.0, Math.min(1.0, value));
  }

  /** Parameters used to construct a [[RenderMaterial]] */
  export class Params {
    /** If the material originates from a Material element in the [[IModel]], the Id of that element. */
    public key?: string;
    /** Diffuse color, or undefined if this material does not override the surface's own color. */
    public diffuseColor?: ColorDef;
    /** Specular color. Defaults to white if undefined. */
    public specularColor?: ColorDef;
    /** Currently unused. */
    public emissiveColor?: ColorDef;
    /** Currently unused. */
    public reflectColor?: ColorDef;
    /** Optional pattern mapping applied to the surface. */
    public textureMapping?: TextureMapping;
    /** Diffuse weight in [0..1] */
    public diffuse: number = 0.6;
    /** Specular weight in [0..1] */
    public specular: number = 0.4;
    public specularExponent: number = 13.5;
    /** Currently unused. */
    public reflect: number = 0.0;
    /** Currently unused. */
    public refract: number = 1.0;
    /** Currently unused. */
    public ambient: number = .3;
    /** Currently unused. */
    public shadows = true;
    private _alpha?: number;

    public constructor(key?: string) { this.key = key; }

    /** Obtain an immutable instance of a RenderMaterial with all default properties. */
    public static readonly defaults = new Params();

    /** A value from 0.0 (fully-transparent) to 1.0 (fully-opaque) controlling the transparency of surfaces to which this material is applied;
     * or undefined if this material does not override surface transparency.
     */
    public get alpha(): number | undefined { return this._alpha; }
    public set alpha(alpha: number | undefined) {
      this._alpha = undefined !== alpha ? clampToNormalizedRange(alpha) : undefined;
    }

    /** Create a RenderMaterial params object using specified key and ColorDef values, as well as an optional texture mapping. */
    public static fromColors(key?: string, diffuseColor?: ColorDef, specularColor?: ColorDef, emissiveColor?: ColorDef, reflectColor?: ColorDef, textureMap?: TextureMapping): Params {
      const materialParams = new Params();
      materialParams.key = key;
      materialParams.diffuseColor = diffuseColor;
      materialParams.specularColor = specularColor;
      materialParams.emissiveColor = emissiveColor;
      materialParams.reflectColor = reflectColor;
      materialParams.textureMapping = textureMap;
      return materialParams;
    }
  }
}

Object.freeze(RenderMaterial.Params.defaults);

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { TransientIdSequence, TransientIdSequenceProps } from "@itwin/core-bentley";
import { _implementationProhibited } from "../Symbols";
import { GraphicDescriptionContextProps, WorkerGraphicDescriptionContext, WorkerGraphicDescriptionContextProps, WorkerTextureParams } from "../../render/GraphicDescriptionContext";
import { MaterialParams } from "../../render/MaterialParams";
import { ColorDef, ColorDefProps, Gradient, ImageBufferFormat, ImageSource, ImageSourceFormat, RenderMaterial, RenderTexture, RgbColor, RgbColorProps, TextureMapping, TextureTransparency } from "@itwin/core-common";
import { ImdlModel } from "../../imdl/ImdlModel";

/** As part of a [[WorkerGraphicDescriptionContext]], describes constraints imposed by the [[RenderSystem]] that a [[GraphicDescriptionBuilder]] needs to know about
 * when creating a [[GraphicDescription]].
 */
export interface GraphicDescriptionConstraints {
  /** @internal */
  readonly [_implementationProhibited]: unknown;
  /** The maximum dimension (width or height) permitted for a single WebGL texture. */
  readonly maxTextureSize: number;
}

export interface WorkerGraphicDescriptionContextPropsImpl extends WorkerGraphicDescriptionContextProps {
  readonly constraints: GraphicDescriptionConstraints;
  readonly transientIds: TransientIdSequenceProps;
}

export interface GraphicDescriptionContextPropsImpl extends GraphicDescriptionContextProps {
  readonly transientIds: TransientIdSequenceProps;
  readonly textures: WorkerTextureProps[];
  /** This is set to true the first time we use RenderSystem.createGraphicDescriptionContext on it.
   * That prevents us from remapping transient Ids to different transient Ids, recreating duplicate textures+materials, etc if
   * somebody tries to resolve the same props more than once.
   * We will throw if somebody tries to re-resolve a GraphicDescriptionContextPropsImpl.
   */
  resolved?: boolean;
}

export interface TextureUrlProps {
  url: string;
  transparency?: TextureTransparency;
  gradient?: never;
  imageBuffer?: never;
  imageSource?: never;
  width?: never;
  format?: never;
}

export interface TextureImageBufferProps {
  imageBuffer: Uint8Array;
  format: ImageBufferFormat;
  transparency?: TextureTransparency;
  width: number;
  gradient?: never;
  imageSource?: never;
  url?: never;
}

export interface TextureImageSourceProps {
  imageSource: Uint8Array | string;
  format: ImageSourceFormat;
  transparency?: TextureTransparency;
  width?: never;
  url?: never;
  imageBuffer?: never;
  gradient?: never;
}

export interface TextureGradientSource {
  gradient: Gradient.Symb;
  transparency?: never;
  format?: never;
  imageBuffer?: never;
  imageSource?: never;
  url?: never;
  width?: never;
}

export type TextureGradientSourceProps = Omit<TextureGradientSource, "gradient"> & { gradient: Gradient.SymbProps };
export type TextureSource = TextureUrlProps | TextureImageBufferProps | TextureImageSourceProps | TextureGradientSource;
export type TextureSourceProps = TextureUrlProps | TextureImageBufferProps | TextureImageSourceProps | TextureGradientSourceProps;

export interface WorkerTextureProps {
  type: RenderTexture.Type;
  transparency?: TextureTransparency;
  source: TextureSourceProps
}

export class WorkerTexture extends RenderTexture {
  public readonly index: number;
  public readonly source: TextureSource;

  public constructor(index: number, params: WorkerTextureParams | Gradient.Symb) {
    let type = RenderTexture.Type.Normal;
    if (!(params instanceof Gradient.Symb) && undefined !== params.type) {
      type = params.type;
    }

    super(type);

    this.index = index;
    if (params instanceof Gradient.Symb) {
      this.source = { gradient: params };
    } else {
      const transparency = params.transparency;
      if (params.source instanceof URL) {
        this.source = { transparency, url: params.source.toString() };
      } else if (params.source instanceof ImageSource) {
        this.source = { transparency, imageSource: params.source.data, format: params.source.format };
      } else {
        this.source = { transparency, imageBuffer: params.source.data, format: params.source.format, width: params.source.width };
      }
    }
  }

  public override dispose() { }
  public override get bytesUsed() { return 0; } // doesn't matter, nobody's calling this.

  public toProps(xfer: Set<Transferable>): WorkerTextureProps {
    const source = this.source.gradient ? { ...this.source, gradient: this.source.gradient.toJSON() } : this.source;
    const buffer = source.imageBuffer ?? source.imageSource;
    if (buffer instanceof Uint8Array) {
      xfer.add(buffer.buffer);
    }

    return {
      type: this.type,
      source,
    }
  }
}

function materialColorToImdl(color: ColorDef | RgbColorProps | undefined): ColorDefProps | undefined {
  if (!(color instanceof ColorDef)) {
    color = RgbColor.fromJSON(color).toColorDef();
  }

  return color?.toJSON();
}

export class WorkerMaterial extends RenderMaterial {
  public readonly params: MaterialParams;

  public constructor(params: MaterialParams) {
    params = {
      alpha: params.alpha,
      diffuse: { ...params.diffuse },
      specular: { ...params.specular },
    };

    let textureMapping;
    if (params.textureMapping) {
      textureMapping = new TextureMapping(params.textureMapping.texture, new TextureMapping.Params({
        textureMat2x3: params.textureMapping.transform,
        mapMode: params.textureMapping.mode,
        textureWeight: params.textureMapping.weight,
        worldMapping: params.textureMapping.worldMapping,
        useConstantLod: params.textureMapping.useConstantLod,
        constantLodProps: params.textureMapping.constantLodProps,
      }));
      textureMapping.normalMapParams = params.textureMapping.normalMapParams;
    }

    super({ textureMapping });

    this.params = params;
  }

  public toImdl(): ImdlModel.SurfaceMaterial {
    let diffuse;
    if (this.params.diffuse) {
      diffuse = {
        weight: this.params.diffuse.weight,
        color: materialColorToImdl(this.params.diffuse.color),
      };
    }

    let specular;
    if (this.params.specular) {
      specular = {
        weight: this.params.specular.weight,
        exponent: this.params.specular.exponent,
        color: materialColorToImdl(this.params.specular.color),
      };
    }

    return {
      isAtlas: false,
      material: {
        alpha: this.params.alpha,
        diffuse,
        specular,
      },
    }
  }
}

export class WorkerGraphicDescriptionContextImpl implements WorkerGraphicDescriptionContext {
  public readonly [_implementationProhibited] = undefined;
  public readonly constraints: GraphicDescriptionConstraints;
  public readonly transientIds: TransientIdSequence;
  public readonly textures: WorkerTexture[] = [];
  public readonly materials: WorkerMaterial[] = [];

  public constructor(props: WorkerGraphicDescriptionContextProps) {
    const propsImpl = props as WorkerGraphicDescriptionContextPropsImpl;
    if (typeof propsImpl.transientIds !== "object" || typeof propsImpl.constraints !== "object") {
      throw new Error("Invalid WorkerGraphicDescriptionContextProps");
    }

    this.constraints = propsImpl.constraints;
    this.transientIds = TransientIdSequence.fromJSON(propsImpl.transientIds);
  }

  public createMaterial(params: MaterialParams): RenderMaterial {
    const material = new WorkerMaterial(params);
    this.materials.push(material);
    return material;
  }

  public createTexture(params: WorkerTextureParams): RenderTexture {
    const texture = new WorkerTexture(this.textures.length, params);
    this.textures.push(texture);
    return texture;
  }

  public createGradientTexture(gradient: Gradient.Symb): RenderTexture {
    const existing = this.textures.find((tx) => tx.source.gradient && tx.source.gradient.equals(gradient));
    if (existing) {
      return existing;
    }

    const texture = new WorkerTexture(this.textures.length, gradient);
    this.textures.push(texture);
    return texture;
  }

  public toProps(transferables: Set<Transferable>): GraphicDescriptionContextPropsImpl {
    // We don't yet have any transferable objects. In the future we expect to support transferring texture image data for textures created on the worker thread.
    return {
      [_implementationProhibited]: undefined,
      transientIds: this.transientIds.toJSON(),
      textures: this.textures.map((tx) => tx.toProps(transferables)),
    };
  }
}


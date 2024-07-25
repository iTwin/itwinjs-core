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

export interface WorkerTextureProps {
  type: RenderTexture.Type;
  transparency?: TextureTransparency;
  source: {
    type: "URL";
    url: string;
    format?: never;
    width?: never;
    gradient?: never;
  } | {
    type: "ImageBuffer";
    data: Uint8Array;
    format: ImageBufferFormat;
    width: number;
    gradient?: never;
  } | {
    type: "ImageSource";
    data: Uint8Array | string;
    format: ImageSourceFormat;
    width?: never;
    url?: never;
    gradient?: never;
  } | {
    type: "Gradient",
    gradient: Gradient.SymbProps;
    format?: never;
    data?: never;
    url?: never;
    width?: never;
  }
}

export class WorkerTexture extends RenderTexture {
  public readonly index: number;
  public readonly params: WorkerTextureParams | Gradient.Symb;

  public constructor(index: number, params: WorkerTextureParams | Gradient.Symb) {
    let type = RenderTexture.Type.Normal;
    if (!(params instanceof Gradient.Symb) && undefined !== params.type) {
      type = params.type;
    }

    super(type);

    this.params = params;
    this.index = index;
  }

  public override dispose() { }
  public override get bytesUsed() { return 0; } // doesn't matter, nobody's calling this.

  public toProps(xfer: Set<Transferable>): WorkerTextureProps {
    let source;
    let transparency;
    if (this.params instanceof Gradient.Symb) {
      source = { type: "Gradient" as const, gradient: this.params.toJSON() };
    } else {
      transparency = this.params.transparency;
      if (this.params.source instanceof URL) {
        source = { type: "URL" as const, url: this.params.source.toString() };
      } else if (this.params.source instanceof ImageSource) {
        if (typeof this.params.source.data !== "string") {
          xfer.add(this.params.source.data.buffer);
        }
      
        source = {
          type: "ImageSource" as const,
          data: this.params.source.data,
          format: this.params.source.format,
        };
      } else {
        xfer.add(this.params.source.data);
        source = {
          type: "ImageBuffer" as const,
          data: this.params.source.data,
          format: this.params.source.format,
          width: this.params.source.width,
        };
      }
    }
    
    return {
      type: this.type,
      source,
      transparency,
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
    const existing = this.textures.find((tx) => tx.params instanceof Gradient.Symb && tx.params.equals(gradient));
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


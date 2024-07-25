/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { SortedArray, TransientIdSequence, TransientIdSequenceProps, assert, compareStrings } from "@itwin/core-bentley";
import { _implementationProhibited } from "../Symbols";
import { GraphicDescriptionContextProps, WorkerGraphicDescriptionContext, WorkerGraphicDescriptionContextProps, WorkerTextureParams } from "../../render/GraphicDescriptionContext";
import { MaterialParams } from "../../render/MaterialParams";
import { Gradient, ImageBufferFormat, ImageSource, ImageSourceFormat, RenderMaterial, RenderTexture, TextureTransparency } from "@itwin/core-common";

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
  /** This is set to true the first time we use RenderSystem.createGraphicDescriptionContext on it.
   * That prevents us from remapping transient Ids to different transient Ids, recreating duplicate textures+materials, etc if
   * somebody tries to resolve the same props more than once.
   * We will throw if somebody tries to re-resolve a GraphicDescriptionContextPropsImpl.
   */
  resolved?: boolean;
}

export interface WorkerTextureProps {
  key: string | Gradient.SymbProps;
  type: RenderTexture.Type;
  transparency?: TextureTransparency;
  source: {
    type: "URL";
    url: string;
    format?: never;
    width?: never;
  } | {
    type: "ImageBuffer";
    data: Uint8Array;
    format: ImageBufferFormat;
    width: number;
  } | {
    type: "ImageSource";
    data: Uint8Array | string;
    format: ImageSourceFormat;
    width?: never;
    url?: never;
  }
}

class WorkerTexture extends RenderTexture {
  public readonly key: string | Gradient.Symb;
  public readonly params: WorkerTextureParams;

  public constructor(key: string | Gradient.Symb, params: WorkerTextureParams) {
    super(params.type ?? RenderTexture.Type.Normal);
    this.key = typeof key === "string" ? key : key.clone();
    this.params = {
      type: params.type,
      source: params.source,
      transparency: params.transparency,
    };
  }

  public override dispose() { }
  public override get bytesUsed() { return 0; } // doesn't matter, nobody's calling this.

  public toProps(xfer: Set<Transferable>): WorkerTextureProps {
    const key = typeof this.key === "string" ? this.key : this.key.toJSON();
    let source;
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

    return {
      type: this.type,
      key,
      source,
      transparency: this.params.transparency,
    }
  }
}

function compareTextureKeys(a: string | Gradient.Symb, b: string | Gradient.Symb): number {
  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) {
    return compareStrings(typeA, typeB);
  }

  if (typeA === "string") {
    assert(typeof a === "string" && typeof b === "string");
    return typeB === "string" ? compareStrings(a, b) : -1;
  }

  assert(a instanceof Gradient.Symb && b instanceof Gradient.Symb);
  return a.compare(b);
}

export class WorkerGraphicDescriptionContextImpl implements WorkerGraphicDescriptionContext {
  public readonly [_implementationProhibited] = undefined;
  public readonly constraints: GraphicDescriptionConstraints;
  public readonly transientIds: TransientIdSequence;
  public readonly textures: SortedArray<WorkerTexture>;

  public constructor(props: WorkerGraphicDescriptionContextProps) {
    const propsImpl = props as WorkerGraphicDescriptionContextPropsImpl;
    if (typeof propsImpl.transientIds !== "object" || typeof propsImpl.constraints !== "object") {
      throw new Error("Invalid WorkerGraphicDescriptionContextProps");
    }

    this.constraints = propsImpl.constraints;
    this.transientIds = TransientIdSequence.fromJSON(propsImpl.transientIds);

    this.textures = new SortedArray<WorkerTexture>((a, b) => compareTextureKeys(a.key, b.key));
  }

  public createMaterial(key: string, params: MaterialParams): RenderMaterial {
    assert(undefined !== key && undefined !== params);
    throw new Error("###TODO");
  }

  public createTexture(key: string, params: WorkerTextureParams): RenderTexture {
    if (this._findTexture(key)) {
      throw new Error(`Texture with key "${key}" already exists`);
    }

    const texture = new WorkerTexture(key, params);
    this.textures.insert(texture);
    return texture;
  }

  public createGradientTexture(gradient: Gradient.Symb): RenderTexture {
    let texture = this._findTexture(gradient);
    if (!texture) {
      let width = 0x100;
      let height = 0x100;
      if (gradient.mode === Gradient.Mode.Thematic) {
        // Pixels in each row are identical, no point in having width > 1.
        width = 1;
        // We want maximum height to minimize bleeding of margin color.
        height = this.constraints.maxTextureSize;
      }

      const source = gradient.produceImage({ width, height, includeThematicMargin: true });
      texture = new WorkerTexture(gradient, {
        source,
        transparency: ImageBufferFormat.Rgba === source.format ? TextureTransparency.Mixed : TextureTransparency.Opaque,
      });

      this.textures.insert(texture);
    }

    return texture;
  }

  public findMaterial() { return undefined; }

  public findTexture(key: string) {
    return this._findTexture(key);
  }

  private _findTexture(key: string | Gradient.Symb): WorkerTexture | undefined {
    return this.textures.findEquivalent((tx) => compareTextureKeys(key, tx.key));
  }
  
  public toProps(_transferables: Set<Transferable>): GraphicDescriptionContextPropsImpl {
    // We don't yet have any transferable objects. In the future we expect to support transferring texture image data for textures created on the worker thread.
    return {
      [_implementationProhibited]: undefined,
      transientIds: this.transientIds.toJSON(),
    };
  }
}


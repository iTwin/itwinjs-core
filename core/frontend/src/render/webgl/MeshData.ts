/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose } from "@itwin/core-bentley";
import type { Point3d } from "@itwin/core-geometry";
import type { FillFlags} from "@itwin/core-common";
import { FeatureIndexType, LinePixels } from "@itwin/core-common";
import type { MeshParams } from "../primitives/VertexTable";
import type { SurfaceType } from "../primitives/SurfaceParams";
import type { RenderMemory } from "../RenderMemory";
import type { WebGLDisposable } from "./Disposable";
import { LineCode } from "./LineCode";
import type { MaterialInfo } from "./Material";
import { createMaterialInfo } from "./Material";
import type { Texture } from "./Texture";
import { VertexLUT } from "./VertexLUT";

/** @internal */
export class MeshData implements WebGLDisposable {
  public readonly edgeWidth: number;
  public readonly hasFeatures: boolean;
  public readonly uniformFeatureId?: number; // Used strictly by BatchPrimitiveCommand.computeIsFlashed for flashing volume classification primitives.
  public readonly texture?: Texture;
  public readonly materialInfo?: MaterialInfo;
  public readonly type: SurfaceType;
  public readonly fillFlags: FillFlags;
  public readonly edgeLineCode: number; // Must call LineCode.valueFromLinePixels(val: LinePixels) and set the output to edgeLineCode
  public readonly isPlanar: boolean;
  public readonly hasBakedLighting: boolean;
  public readonly hasFixedNormals: boolean;   // Fixed normals will not be flipped to face front (Terrain skirts).
  public readonly lut: VertexLUT;
  public readonly viewIndependentOrigin?: Point3d;
  private readonly _textureAlwaysDisplayed: boolean;

  private constructor(lut: VertexLUT, params: MeshParams, viOrigin: Point3d | undefined) {
    this.lut = lut;
    this.viewIndependentOrigin = viOrigin;

    this.hasFeatures = FeatureIndexType.Empty !== params.vertices.featureIndexType;
    if (FeatureIndexType.Uniform === params.vertices.featureIndexType)
      this.uniformFeatureId = params.vertices.uniformFeatureID;

    if (undefined !== params.surface.textureMapping) {
      this.texture = params.surface.textureMapping.texture as Texture;
      this._textureAlwaysDisplayed = params.surface.textureMapping.alwaysDisplayed;
    } else {
      this.texture = undefined;
      this._textureAlwaysDisplayed = false;
    }

    this.materialInfo = createMaterialInfo(params.surface.material);

    this.type = params.surface.type;
    this.fillFlags = params.surface.fillFlags;
    this.isPlanar = params.isPlanar;
    this.hasBakedLighting = params.surface.hasBakedLighting;
    this.hasFixedNormals = params.surface.hasFixedNormals;
    const edges = params.edges;
    this.edgeWidth = undefined !== edges ? edges.weight : 1;
    this.edgeLineCode = LineCode.valueFromLinePixels(undefined !== edges ? edges.linePixels : LinePixels.Solid);
  }

  public static create(params: MeshParams, viOrigin: Point3d | undefined): MeshData | undefined {
    const lut = VertexLUT.createFromVertexTable(params.vertices, params.auxChannels);
    return undefined !== lut ? new MeshData(lut, params, viOrigin) : undefined;
  }

  public get isDisposed(): boolean { return undefined === this.texture && this.lut.isDisposed; }

  public dispose() {
    dispose(this.lut);
    if (this._ownsTexture)
      this.texture!.dispose();
  }

  public get isGlyph() { return undefined !== this.texture && this.texture.isGlyph; }
  public get isTextureAlwaysDisplayed() { return this.isGlyph || this._textureAlwaysDisplayed; }

  // Returns true if no one else owns this texture. Implies that the texture should be disposed when this object is disposed, and the texture's memory should be tracked as belonging to this object.
  private get _ownsTexture(): boolean {
    return undefined !== this.texture && !this.texture?.hasOwner;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addVertexTable(this.lut.bytesUsed);
    if (this._ownsTexture)
      stats.addTexture(this.texture!.bytesUsed);
  }
}

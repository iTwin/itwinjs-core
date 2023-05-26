/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { FeatureIndexType, FillFlags, LinePixels } from "@itwin/core-common";
import { MeshParams } from "../../common/render/primitives/MeshParams";
import { SurfaceType } from "../../common/render/primitives/SurfaceParams";
import { RenderMemory } from "../RenderMemory";
import { WebGLDisposable } from "./Disposable";
import { LineCode } from "./LineCode";
import { createMaterialInfo, MaterialInfo } from "./Material";
import { Texture } from "./Texture";
import { VertexLUT } from "./VertexLUT";

/** @internal */
export class MeshData implements WebGLDisposable {
  public readonly edgeWidth: number;
  public readonly hasFeatures: boolean;
  public readonly uniformFeatureId?: number; // Used strictly by BatchPrimitiveCommand.computeIsFlashed for flashing volume classification primitives.
  public readonly texture?: Texture;
  public readonly normalMap?: Texture;
  public readonly constantLodVParams?: Float32Array; // size 3, contains texture offset x & y and fake ortho distance (which will be set during binding)
  public readonly constantLodFParams?: Float32Array; // size 3, texture min and max size in worl units
  public readonly textureUsesConstantLod?: boolean;
  public readonly normalMapUsesConstantLod?: boolean;
  public readonly materialInfo?: MaterialInfo;
  public readonly type: SurfaceType;
  public readonly fillFlags: FillFlags;
  public readonly edgeLineCode: number; // Must call LineCode.valueFromLinePixels(val: LinePixels) and set the output to edgeLineCode
  public readonly isPlanar: boolean;
  public readonly hasBakedLighting: boolean;
  public readonly lut: VertexLUT;
  public readonly viewIndependentOrigin?: Point3d;
  private readonly _textureAlwaysDisplayed: boolean;

  private constructor(lut: VertexLUT, params: MeshParams, viOrigin: Point3d | undefined) {
    this.lut = lut;
    this.viewIndependentOrigin = viOrigin;

    this.hasFeatures = FeatureIndexType.Empty !== params.vertices.featureIndexType;
    if (FeatureIndexType.Uniform === params.vertices.featureIndexType)
      this.uniformFeatureId = params.vertices.uniformFeatureID;

    this.textureUsesConstantLod = false;
    this.normalMapUsesConstantLod = false;
    if (undefined !== params.surface.textureMapping) {
      this.texture = params.surface.textureMapping.texture as Texture;
      this._textureAlwaysDisplayed = params.surface.textureMapping.alwaysDisplayed;
      if (undefined !== params.surface.material && !params.surface.material.isAtlas) {
        const matTM = params.surface.material.material.textureMapping;
        if (undefined !== matTM) {
          this.textureUsesConstantLod = this.texture && matTM.params.useConstantLod;
          if (undefined !== matTM.normalMapParams) {
            this.normalMapUsesConstantLod = matTM.normalMapParams.useConstantLod;
            if (undefined !== matTM.normalMapParams.normalMap) {
              this.normalMap = matTM.normalMapParams.normalMap as Texture;
            } else {
              // If there are normal map params but the normal map is not present, use the texture as a normal map instead of a pattern map.
              this.normalMap = this.texture;
              this.texture = undefined;
            }
          }
          if (this.normalMapUsesConstantLod || this.textureUsesConstantLod) {
            this.constantLodVParams = new Float32Array(3);
            this.constantLodVParams[0] = matTM.params.constantLodParams.offset.x; // x offset
            this.constantLodVParams[1] = matTM.params.constantLodParams.offset.y; // y offset
            this.constantLodVParams[3] = 0.0;                                     // placeholder for orto view distance
            this.constantLodFParams = new Float32Array(3);
            this.constantLodFParams[0] = matTM.params.constantLodParams.minDistClamp; // Minimum texture size
            this.constantLodFParams[1] = matTM.params.constantLodParams.maxDistClamp; // Maximum texture size
            this.constantLodFParams[2] = matTM.params.constantLodParams.repetitions;  // # repetitions of pattern (to scale it)
          }
        }
      }
    } else {
      this.texture = undefined;
      this._textureAlwaysDisplayed = false;
    }

    this.materialInfo = createMaterialInfo(params.surface.material);

    this.type = params.surface.type;
    this.fillFlags = params.surface.fillFlags;
    this.isPlanar = params.isPlanar;
    this.hasBakedLighting = params.surface.hasBakedLighting;
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

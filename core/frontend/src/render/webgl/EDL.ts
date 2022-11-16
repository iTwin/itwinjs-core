/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { RenderMemory } from "../RenderMemory";
import { EDLCalcBasicGeometry, EDLCalcFullGeometry, EDLFilterGeometry, EDLMixGeometry } from "./CachedGeometry";
import { WebGLDisposable } from "./Disposable";
import { DepthBuffer, FrameBuffer } from "./FrameBuffer";
import { GL } from "./GL";
import { RenderState } from "./RenderState";
import { collectGeometryStatistics, collectTextureStatistics } from "./SceneCompositor";
import { getDrawParams } from "./ScratchDrawParams";
import { System } from "./System";
import { Target } from "./Target";
import { TextureHandle } from "./Texture";

class Bundle implements WebGLDisposable {
  private constructor(
    public edlCalcTex1?: TextureHandle,
    public edlCalcTex2?: TextureHandle,
    public edlCalcTex4?: TextureHandle,
    public edlFiltTex2?: TextureHandle,
    public edlFiltTex4?: TextureHandle,

    public edlCalcFbo1?: FrameBuffer,
    public edlCalcFbo2?: FrameBuffer,
    public edlCalcFbo4?: FrameBuffer,
    public edlFiltFbo2?: FrameBuffer,
    public edlFiltFbo4?: FrameBuffer,

    public edlCalcBasicGeom?: EDLCalcBasicGeometry,
    public edlCalcFullGeom?: [EDLCalcFullGeometry | undefined, EDLCalcFullGeometry | undefined, EDLCalcFullGeometry | undefined],
    public edlFiltGeom?: [EDLFilterGeometry | undefined, EDLFilterGeometry | undefined],
    public edlMixGeom?: EDLMixGeometry) {
  }

  public static create(width: number, height: number): Bundle | undefined {
    const edlCalcTex1 = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    const edlCalcTex2 = TextureHandle.createForAttachment(width >> 1, height >> 1, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    const edlCalcTex4 = TextureHandle.createForAttachment(width >> 2, height >> 2, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    const edlFiltTex2 = TextureHandle.createForAttachment(width >> 1, height >> 1, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    const edlFiltTex4 = TextureHandle.createForAttachment(width >> 2, height >> 2, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (undefined === edlCalcTex1 || undefined === edlCalcTex2 || undefined === edlCalcTex4 || undefined === edlFiltTex2 || undefined === edlFiltTex4) {
      dispose (edlCalcTex1);
      dispose (edlCalcTex2);
      dispose (edlCalcTex4);
      dispose (edlFiltTex2);
      dispose (edlFiltTex4);
      return undefined;
    }
    const edlCalcFbo1 = FrameBuffer.create([edlCalcTex1]);
    const edlCalcFbo2 = FrameBuffer.create([edlCalcTex2]);
    const edlCalcFbo4 = FrameBuffer.create([edlCalcTex4]);
    const edlFiltFbo2 = FrameBuffer.create([edlFiltTex2]);
    const edlFiltFbo4 = FrameBuffer.create([edlFiltTex4]);
    if (undefined === edlCalcFbo1 || undefined === edlCalcFbo2 || undefined === edlCalcFbo4 || undefined === edlFiltFbo2 || undefined === edlFiltFbo4) {
      dispose (edlCalcFbo1);
      dispose (edlCalcFbo2);
      dispose (edlCalcFbo4);
      dispose (edlFiltFbo2);
      dispose (edlFiltFbo4);
      return undefined;
    }
    return new Bundle(edlCalcTex1, edlCalcTex2, edlCalcTex4, edlFiltTex2, edlFiltTex4, edlCalcFbo1, edlCalcFbo2, edlCalcFbo4, edlFiltFbo2, edlFiltFbo4);
  }

  public get isDisposed(): boolean {
    return undefined === this.edlCalcTex1
      && undefined === this.edlCalcTex2
      && undefined === this.edlCalcTex4
      && undefined === this.edlFiltTex2
      && undefined === this.edlFiltTex4
      && undefined === this.edlCalcFbo1
      && undefined === this.edlCalcFbo2
      && undefined === this.edlCalcFbo4
      && undefined === this.edlFiltFbo2
      && undefined === this.edlFiltFbo4
      && undefined === this.edlCalcBasicGeom
      && undefined === this.edlCalcFullGeom?.[0]
      && undefined === this.edlCalcFullGeom?.[1]
      && undefined === this.edlCalcFullGeom?.[2]
      && undefined === this.edlCalcFullGeom
      && undefined === this.edlFiltGeom?.[0]
      && undefined === this.edlFiltGeom?.[1]
      && undefined === this.edlFiltGeom
      && undefined === this.edlMixGeom;
  }

  public dispose(): void {
    this.edlCalcTex1 = dispose(this.edlCalcTex1);
    this.edlCalcTex2 = dispose(this.edlCalcTex2);
    this.edlCalcTex4 = dispose(this.edlCalcTex4);
    this.edlFiltTex2 = dispose(this.edlFiltTex2);
    this.edlFiltTex4 = dispose(this.edlFiltTex4);
    this.edlCalcFbo1 = dispose(this.edlCalcFbo1);
    this.edlCalcFbo2 = dispose(this.edlCalcFbo2);
    this.edlCalcFbo4 = dispose(this.edlCalcFbo4);
    this.edlFiltFbo2 = dispose(this.edlFiltFbo2);
    this.edlFiltFbo4 = dispose(this.edlFiltFbo4);
    this.edlCalcBasicGeom = dispose(this.edlCalcBasicGeom);
    if (this.edlCalcFullGeom) {
      this.edlCalcFullGeom[0] = dispose(this.edlCalcFullGeom?.[0]);
      this.edlCalcFullGeom[1] = dispose(this.edlCalcFullGeom?.[1]);
      this.edlCalcFullGeom[2] = dispose(this.edlCalcFullGeom?.[2]);
      this.edlCalcFullGeom = undefined;
    }
    if (this.edlFiltGeom) {
      this.edlFiltGeom[0] = dispose(this.edlFiltGeom?.[0]);
      this.edlFiltGeom[1] = dispose(this.edlFiltGeom?.[1]);
      this.edlFiltGeom = undefined;
    }
    this.edlMixGeom = dispose(this.edlMixGeom);
  }
}

/** @internal */
export enum EDLMode { Off, On, Full }

/** @internal */
export interface EDLDrawParams {
  inputTex: TextureHandle;  // input to calc EDL from
  outputTex: TextureHandle; // output to put EDL result in (using fbo from it)
  edlStrength: number;      // > 0 enables EDL
  edlMode: EDLMode;
  edlFilter: boolean;       // applies to Full mode only
  useMsBuffers: boolean;
}

export class EyeDomeLighting implements RenderMemory.Consumer, WebGLDisposable {
  private _bundle?: Bundle;
  private _width: number;
  private _height: number;
  private _depth?: DepthBuffer;
  private _edlFinalFbo?: FrameBuffer;
  private readonly _target: Target;

  private getBundle(): Bundle | undefined {
    if (undefined === this._bundle) {
      this._bundle = Bundle.create(this._width, this._height);
      assert(undefined !== this._bundle);
    }
    return this._bundle;
  }

  public constructor(target: Target) {
    this._target = target;
    this._width = target.viewRect.width;
    this._height = target.viewRect.height;
  }

  public init(width: number, height: number, depth: DepthBuffer): boolean {
    this._width = width;
    this._height = height;
    this._depth = depth;
    // don't create buffers until we know we will use them (first draw)
    return true;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    const bundle = this._bundle;
    if (undefined !== bundle) {
      collectTextureStatistics(bundle.edlCalcTex1, stats);
      collectTextureStatistics(bundle.edlCalcTex2, stats);
      collectTextureStatistics(bundle.edlCalcTex4, stats);
      collectTextureStatistics(bundle.edlFiltTex2, stats);
      collectTextureStatistics(bundle.edlFiltTex4, stats);

      collectGeometryStatistics(bundle.edlCalcBasicGeom, stats);
      collectGeometryStatistics(bundle.edlCalcFullGeom?.[0], stats);
      collectGeometryStatistics(bundle.edlCalcFullGeom?.[1], stats);
      collectGeometryStatistics(bundle.edlCalcFullGeom?.[2], stats);
      collectGeometryStatistics(bundle.edlFiltGeom?.[0], stats);
      collectGeometryStatistics(bundle.edlFiltGeom?.[1], stats);
      collectGeometryStatistics(bundle.edlMixGeom, stats);
    }
  }

  public get isDisposed(): boolean { return undefined === this._bundle && undefined === this._edlFinalFbo; }

  public dispose() {
    this._bundle = dispose(this._bundle);
    this._edlFinalFbo = dispose (this._edlFinalFbo);
  }

  public reset() {
    this.dispose();
  }

  /** calculate EyeDomeLighting at specified quality using screen space shaders
   * returns true if succeeds
   */
  public draw(edlParams: EDLDrawParams): boolean {
    if (undefined === edlParams.inputTex || undefined === this._depth || undefined === edlParams.outputTex)
      return false;

    const bundle = this.getBundle();
    if (undefined === bundle)
      return false;

    if (undefined === this._edlFinalFbo || edlParams.outputTex !== this._edlFinalFbo.getColor(0)) {
      this._edlFinalFbo = dispose (this._edlFinalFbo);
      this._edlFinalFbo = FrameBuffer.create([edlParams.outputTex]);
      if (undefined === this._edlFinalFbo)
        return false;
    }

    const fbStack = System.instance.frameBufferStack;
    const useMsBuffers = edlParams.useMsBuffers;
    System.instance.applyRenderState(RenderState.defaults);

    // ###TODO figure out multisampling
    // ###TODO: should radius be (optionally?) voxel based instead of pixel here?
    if (edlParams.edlMode === EDLMode.On) {
      // draw using enhanced version of simple (8 samples, still single draw)
      fbStack.execute(this._edlFinalFbo, true, edlParams.useMsBuffers, () => {
        if (bundle.edlCalcBasicGeom === undefined) {
          const ct1 = edlParams.inputTex;
          const ctd = this._depth!.getHandle()!;
          bundle.edlCalcBasicGeom = EDLCalcBasicGeometry.createGeometry(ct1.getHandle()!, ctd, ct1.width, ct1.height);
        }
        const params = getDrawParams(this._target, bundle.edlCalcBasicGeom!);
        this._target.techniques.draw(params);
      });
    } else { // EDLMode.Full
      // draw with full method based on original paper using full, 1/2, and 1/4 sizes
      const edlCalc2FB: FrameBuffer[] = [bundle.edlCalcFbo1!, bundle.edlCalcFbo2!, bundle.edlCalcFbo4!];
      if (bundle.edlCalcFullGeom === undefined) {
        const ct1 = edlParams.inputTex;
        const ct2 = bundle.edlCalcTex2;
        const ct4 = bundle.edlCalcTex4;
        const ctd = this._depth.getHandle()!;
        bundle.edlCalcFullGeom = [EDLCalcFullGeometry.createGeometry(ct1.getHandle()!, ctd, 1, ct1.width, ct1.height),
          EDLCalcFullGeometry.createGeometry(ct1.getHandle()!, ctd, 2, ct2!.width, ct2!.height),
          EDLCalcFullGeometry.createGeometry(ct1.getHandle()!, ctd, 4, ct4!.width, ct4!.height)];
      }

      const edlFiltFbos: FrameBuffer[] = [bundle.edlFiltFbo2!, bundle.edlFiltFbo4!];
      if (bundle.edlFiltGeom === undefined) {
        const ft2 = bundle.edlCalcTex2;
        const ft4 = bundle.edlCalcTex4;
        const ftd = this._depth.getHandle()!;
        bundle.edlFiltGeom = [EDLFilterGeometry.createGeometry(ft2!.getHandle()!, ftd, 2, ft2!.width, ft2!.height),
          EDLFilterGeometry.createGeometry(ft4!.getHandle()!, ftd, 4, ft4!.width, ft4!.height)];
      }

      const gl = System.instance.context;
      // Loop through the 3 sizes calculating an edl buffer, and if not first size, then optionally filtering those
      for (let i = 0; i < 3; ++i) {
        fbStack.execute(edlCalc2FB[i], true, useMsBuffers, () => {
          const colTex = edlCalc2FB[i].getColor(0);
          gl.viewport(0, 0, colTex.width, colTex.height); // have to set viewport to current texture size
          const params = getDrawParams(this._target, bundle.edlCalcFullGeom![i]!);
          this._target.techniques.draw(params);
        });

        if (edlParams.edlFilter && i > 0) {
          fbStack.execute(edlFiltFbos[i-1], true, useMsBuffers, () => {
            const params = getDrawParams(this._target, bundle.edlFiltGeom![i-1]!);
            this._target.techniques.draw(params);
          });
        }
      }
      gl.viewport(0, 0, this._width, this._height); // Restore viewport

      // Now combine the 3 results and output
      const tex1 = bundle.edlCalcTex1!.getHandle();
      const tex2 = edlParams.edlFilter ? bundle.edlFiltTex2!.getHandle() : bundle.edlCalcTex2!.getHandle();
      const tex4 = edlParams.edlFilter ? bundle.edlFiltTex4!.getHandle() : bundle.edlCalcTex4!.getHandle();
      fbStack.execute(this._edlFinalFbo, true, useMsBuffers, () => {
        if (bundle.edlMixGeom === undefined) {
          bundle.edlMixGeom = EDLMixGeometry.createGeometry(tex1!, tex2!, tex4!);
        } else {
          if (bundle.edlMixGeom.colorTexture1 !== tex1 || bundle.edlMixGeom.colorTexture2 !== tex2 || bundle.edlMixGeom.colorTexture4 !== tex4) {
            dispose(bundle.edlMixGeom);
            bundle.edlMixGeom = EDLMixGeometry.createGeometry(tex1!, tex2!, tex4!);
          }
        }
        const params = getDrawParams(this._target, bundle.edlMixGeom!);
        this._target.techniques.draw(params);
      });
    }
    return true;
  }
}

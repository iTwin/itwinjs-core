/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGPU
 */

import { BentleyStatus } from "@itwin/core-bentley";
import { ElementAlignedBox3d, IModelError, RenderFeatureTable  } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
// import { ViewRect } from "../../common/ViewRect";
import { RenderAreaPattern, RenderGeometry, RenderSystem } from "../RenderSystem";
import { RenderTarget } from "../RenderTarget";
import { ViewRect } from "../../common/ViewRect";
import { WebGPUTarget } from "./Target";
import { BatchOptions, CustomGraphicBuilderOptions, GraphicBuilder, ViewportGraphicBuilderOptions } from "../GraphicBuilder";
import { InstancedGraphicParams } from "../InstancedGraphicParams";
import { RenderGraphic } from "../RenderGraphic";
import { GraphicBranch, GraphicBranchOptions } from "../GraphicBranch";
import { Transform } from "@itwin/core-geometry";
import { PrimitiveBuilder } from "../primitives/geometry/GeometryListBuilder";
import { Batch, Branch, GraphicsArray } from "../webgl/Graphic";

/* eslint-disable no-restricted-syntax */

/** @internal */
export const enum ContextState {
  Uninitialized,
  Success,
  Error,
}

/** @internal */
export class WebGPUSystem extends RenderSystem {
  public readonly canvas: HTMLCanvasElement;
  // public readonly currentRenderState = new RenderState();
  public readonly context: GPUCanvasContext;
  // public readonly frameBufferStack = new FrameBufferStack();  // frame buffers are not owned by the system
  // private readonly _capabilities: Capabilities;
  // public readonly resourceCache: Map<IModelConnection, IdMap>;
  // private readonly _textureBindings: TextureBinding[] = [];
  private _removeEventListener?: () => void;

  protected constructor(canvas: HTMLCanvasElement, context: GPUCanvasContext) {
    super();
    this.canvas = canvas;
    this.context = context;

    // Make this System a subscriber to the the IModelConnection onClose event
    this._removeEventListener = IModelConnection.onClose.addListener((_imodel) => { });
  }

  public static get instance() { return IModelApp.renderSystem as WebGPUSystem; }

  public get isValid(): boolean { return this.canvas !== undefined; }

  /** Attempt to create a WebGLRenderingContext, returning undefined if unsuccessful. */
  public static createContext(canvas: HTMLCanvasElement): GPUCanvasContext | undefined {
    const context = canvas.getContext("webgpu");
    return context ?? undefined;
  }

  public static create(_optionsIn?: RenderSystem.Options): WebGPUSystem {
    // const options: RenderSystem.Options = undefined !== optionsIn ? optionsIn : {};
    const canvas = document.createElement("canvas");
    if (null === canvas)
      throw new IModelError(BentleyStatus.ERROR, "Failed to obtain HTMLCanvasElement");

    const context = this.createContext(canvas);
    if (undefined === context)
      throw new IModelError(BentleyStatus.ERROR, "Failed to obtain WebGPU context");

    return new this(canvas, context);
  }

  public override onInitialized(): void {
  }

  public dispose(): void {
  }

  public createTarget(_canvas: HTMLCanvasElement): RenderTarget {
    return new WebGPUTarget(this);
  }

  public createOffscreenTarget(_rect: ViewRect): RenderTarget {
    return new WebGPUTarget(this);
  }

  public doIdleWork(): boolean { return false; }

  public createGraphic(options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions): GraphicBuilder {
    return new PrimitiveBuilder(this, options);
  }

  public createRenderGraphic(_geometry: RenderGeometry, _instances?: InstancedGraphicParams | RenderAreaPattern): RenderGraphic | undefined {
    return undefined;
  }

  public createGraphicList(primitives: RenderGraphic[]): RenderGraphic {
    return new GraphicsArray(primitives);
  }

  public createGraphicBranch(branch: GraphicBranch, transform: Transform, options?: GraphicBranchOptions): RenderGraphic {
    return new Branch(branch, transform, undefined, options);
  }

  public createBatch(graphic: RenderGraphic, features: RenderFeatureTable, range: ElementAlignedBox3d, options?: BatchOptions): RenderGraphic {
    return new Batch(graphic, features, range, options);
  }
}

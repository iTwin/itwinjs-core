/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGPU
 */

import { BentleyStatus } from "@itwin/core-bentley";
import { ElementAlignedBox3d, IModelError, RenderFeatureTable } from "@itwin/core-common";
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
  public readonly mainCanvas: HTMLCanvasElement;
  public readonly mainContext: GPUCanvasContext;
  private _device: GPUDevice | undefined;
  private _renderPipeline: GPURenderPipeline | undefined;
  private _commandEncoder: GPUCommandEncoder | undefined;
  private _renderPassDescriptor: GPURenderPassDescriptor | undefined;
  private _removeEventListener?: () => void;
  private _canvasContextMap = new Map<HTMLCanvasElement, GPUCanvasContext>();

  protected constructor(canvas: HTMLCanvasElement, context: GPUCanvasContext) {
    super();
    this.mainCanvas = canvas;
    this.mainContext = context;
    this._canvasContextMap.set(canvas, context);
    this._removeEventListener = IModelConnection.onClose.addListener((_imodel) => { });
  }

  public static get instance() { return IModelApp.renderSystem as WebGPUSystem; }

  public get isValid(): boolean { return this.mainCanvas !== undefined; }

  public static createContext(canvas: HTMLCanvasElement): GPUCanvasContext | undefined {
    const context = canvas.getContext("webgpu");
    return context ?? undefined;
  }

  public static async create(_optionsIn?: RenderSystem.Options): Promise<WebGPUSystem> {
    const canvas = document.createElement("canvas");
    if (null === canvas) {
      throw new IModelError(BentleyStatus.ERROR, "Failed to obtain HTMLCanvasElement");
    }
    const context = this.createContext(canvas);
    if (undefined === context) {
      throw new IModelError(BentleyStatus.ERROR, "Failed to obtain WebGPU context");
    }
    const system = new this(canvas, context);
    await system.initialize();
    return system;
  }

  public override onInitialized(): void {}

  public dispose(): void {}

  public createTarget(canvas: HTMLCanvasElement): RenderTarget {
    const context = WebGPUSystem.createContext(canvas);
    if (context) {
      this._canvasContextMap.set(canvas, context);
      this.initializeTarget(canvas);
    }
    return new WebGPUTarget(this, canvas);
  }

  public createOffscreenTarget(_rect: ViewRect): RenderTarget {
    const canvas = document.createElement("canvas");
    const context = WebGPUSystem.createContext(canvas);
    if (context) {
      this._canvasContextMap.set(canvas, context);
      this.initializeTarget(canvas);
    }
    return new WebGPUTarget(this, canvas);
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

  private async initialize(): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
      throw new IModelError(BentleyStatus.ERROR, "Failed to get GPU adapter");
    this._device = await adapter.requestDevice();

    const format = navigator.gpu.getPreferredCanvasFormat();

    if (!this._device) {
      throw new IModelError(BentleyStatus.ERROR, "Failed to obtain GPU device");
    }
    this._canvasContextMap.forEach((context) => {
      context.configure({
        device: this._device as GPUDevice,
        format,
      });
    });

    const pipelineLayout = this._device.createPipelineLayout({
      bindGroupLayouts: [],
    });

    const pipeline = this._device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this._device.createShaderModule({
          code: `
            @vertex
            fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
              var pos = array<vec2<f32>, 3>(
                vec2<f32>( 0.0,  0.5),
                vec2<f32>(-0.5, -0.5),
                vec2<f32>( 0.5, -0.5)
              );
              return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
            }`,
        }),
        entryPoint: "main",
      },
      fragment: {
        module: this._device.createShaderModule({
          code: `
            @fragment
            fn main() -> @location(0) vec4<f32> {
              return vec4<f32>(1.0, 0.0, 0.0, 1.0);
            }`,
        }),
        entryPoint: "main",
        targets: [
          {
            format,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    this._renderPipeline = pipeline;
    const textureView: GPUTextureView = this.mainContext.getCurrentTexture().createView();
    this._renderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.5, b: 0.5, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };
  }

  public initializeTarget(canvas: HTMLCanvasElement): void {
    if (!this._device)
      return;

    const context = this._canvasContextMap.get(canvas);
    if (!context)
      return;

    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
      device: this._device,
      format,
    });
  }

  public render(canvas: HTMLCanvasElement): void {
    const context = this._canvasContextMap.get(canvas);
    if (!this._device || !this._renderPipeline || !this._renderPassDescriptor || !context) {
      return;
    }

    const textureView = context.getCurrentTexture().createView();
    (this._renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = textureView;

    const commandEncoder = this._device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(this._renderPassDescriptor);
    passEncoder.setPipeline(this._renderPipeline);
    passEncoder.draw(3, 1, 0, 0);
    passEncoder.end();

    this._device.queue.submit([commandEncoder.finish()]);
  }
}

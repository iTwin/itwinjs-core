/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { BeEvent } from "@itwin/core-bentley";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import { Viewport } from "../../Viewport";
import { FrameBuffer, FrameBufferStack } from "./FrameBuffer";
import { FrustumUniformType } from "./FrustumUniforms";
import { RenderCommands } from "./RenderCommands";
import { CompositeFlags } from "./RenderFlags";
import { System } from "./System";

/** @internal */
export interface FrameRenderData {
  commands: RenderCommands;
  needComposite: boolean;
  compositeFlags: CompositeFlags;
  fbo: FrameBuffer;
  frameBufferStack: FrameBufferStack;
}

/** @internal */
export interface FrameBeforeRenderData {
  renderSystem: System;
  viewport: Viewport;
  setSceneNeedRedraw: (redraw: boolean) => void;
}

/** @internal */
export interface FrameCameraFrustumData {
  type: FrustumUniformType;
  left: number;
  right: number;
  bottom: number;
  top: number;
  front: number;
  back: number;
}

/** @internal */
export interface FrameCameraViewData {
  cameraPosition: Point3d;
  viewX: Vector3d;
  viewY: Vector3d;
  viewZ: Vector3d;
}

/** @internal */
export class IModelFrameLifecycle {
  public static readonly onBeforeRender = new BeEvent<(data: FrameBeforeRenderData) => void>();
  public static readonly onRenderOpaque = new BeEvent<(data: FrameRenderData) => void>();
  public static readonly onChangeCameraFrustum = new BeEvent<(data: FrameCameraFrustumData) => void>();
  public static readonly onChangeCameraView = new BeEvent<(data: FrameCameraViewData) => void>();
}

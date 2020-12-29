/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */

import { assert } from "@bentley/bentleyjs-core";
import { IModelApp, Tool, UniformType, VaryingType } from "@bentley/imodeljs-frontend";
import { parseToggle } from "../tools/parseToggle";

interface Kernel {
  enabled?: true;
  registered?: true;
  matrix: number[],
}

interface Kernels {
  gaussianBlur: Kernel,
  unsharpen: Kernel,
  emboss: Kernel,
  sharpness: Kernel,
  sharpen: Kernel,
  edgeDetect: Kernel,
}

const kernels: Kernels = {
  gaussianBlur: {
    matrix: [
      0.045, 0.122, 0.045,
      0.122, 0.332, 0.122,
      0.045, 0.122, 0.045
    ],
  },
  unsharpen: {
    matrix: [
      -1, -1, -1,
      -1,  9, -1,
      -1, -1, -1
    ],
  },
  emboss: {
    matrix: [
      -2, -1,  0,
      -1,  1,  1,
      0,  1,  2
    ],
  },
  sharpness: {
    matrix: [
      0,-1, 0,
      -1, 5,-1,
      0,-1, 0
    ],
  },
  sharpen: {
    matrix: [
      0,-1, 0,
      -1, 5,-1,
      0,-1, 0
    ],
  },
  edgeDetect: {
    matrix: [
      -5, 0, 0,
      0, 0, 0,
      0, 0, 5
    ],
  },
};

type KernelName = keyof Kernels;

function registerEffect(name: KernelName): void {
  const kernel = kernels[name];
  if (kernel.registered)
    return;

  kernel.registered = true;

  // The vertex shader simply computes the texture coordinate for use in the fragment shader.
  const vertex = `
    void effectMain(vec4 pos) {
      v_texCoord = textureCoordFromPosition(pos);
    }`;

  // The fragment shader samples the pixel and its neighbors and applies the kernel.
  const fragment = `
    vec4 effectMain() {
      vec2 onePixel = vec2(1.0, 1.0) / u_textureSize;
      vec4 colorSum =
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2(-1, -1)) * u_kernel[0] +
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2( 0, -1)) * u_kernel[1] +
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2( 1, -1)) * u_kernel[2] +
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2(-1,  0)) * u_kernel[3] +
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2( 0,  0)) * u_kernel[4] +
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2( 1,  0)) * u_kernel[5] +
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2(-1,  1)) * u_kernel[6] +
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2( 0,  1)) * u_kernel[7] +
        TEXTURE(u_diffuse, v_texCoord + onePixel * vec2( 1,  1)) * u_kernel[8] ;
      return vec4((colorSum / u_kernelWeight).rgb, 1);
    }`;

  const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder({
    name: `fdt convolution ${name}`,
    textureCoordFromPosition: true,
    source: { vertex, fragment },
  });

  // Don't bother applying the effect if no kernels are enabled.
  assert(undefined !== builder);
  builder.shouldApply = () => true === kernel.enabled;

  // Define the varying for the texture coordinate.
  builder.addVarying("v_texCoord", VaryingType.Vec2);

  // Hook up the uniforms.
  builder.addUniform({
    name: "u_textureSize",
    type: UniformType.Vec2,
    bind: (uniform, context) => {
      const rect = context.viewport.viewRect;
      uniform.setUniform2fv([ rect.width, rect.height ]);
    },
  });
  builder.addUniformArray({
    name: "u_kernel",
    type: UniformType.Float,
    length: kernel.matrix.length,
    bind: (uniform) => uniform.setUniform1fv(kernel.matrix),
  });

  let weight = kernel.matrix.reduce((prev, curr) => prev + curr);
  if (weight <= 0)
    weight = 1;

  builder.addUniform({
    name: "u_kernelWeight",
    type: UniformType.Float,
    bind: (uniform) => uniform.setUniform1f(weight),
  });

  // Compile and register the effect shader.
  builder.finish();
}

function toggleEffect(name: KernelName, enable: boolean | undefined): void {
  const kernel = kernels[name];
  if (undefined === enable)
    enable = true !== kernel.enabled;

  kernel.enabled = enable ? true : undefined;

  // Make sure the effect is registered, and ensure all viewports will redraw immediately to reflect the changes.
  registerEffect(name);
  IModelApp.viewManager.invalidateViewportScenes();
}

/** Toggles one of a collection of "convolution kernels" that alter a [Viewport]($frontend)'s image by blending neighboring pixels.
 * Based on https://webglfundamentals.org/webgl/lessons/webgl-image-processing-continued.html
 * @beta
 */
export abstract class ConvolutionEffect extends Tool {
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  protected abstract get kernelName(): KernelName;

  public run(enable?: boolean): boolean {
    toggleEffect(this.kernelName, enable);
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if ("string" !== typeof(enable))
      this.run(enable);

    return true;
  }
}

/** Toggles a gaussian blur screen-space effect.
 * @beta
 */
export class GaussianBlurEffect extends ConvolutionEffect {
  public static toolId = "GaussianBlurEffect";
  protected get kernelName(): KernelName { return "gaussianBlur"; }
}

/** Toggles a screen-space unsharpen effect.
 * @beta
 */
export class UnsharpenEffect extends ConvolutionEffect {
  public static toolId = "UnsharpenEffect";
  protected get kernelName(): KernelName { return "unsharpen"; }
}

/** Toggles a screen-space emboss effect.
 * @beta
 */
export class EmbossEffect extends ConvolutionEffect {
  public static toolId = "EmbossEffect";
  protected get kernelName(): KernelName { return "emboss"; }
}

/** Toggles a screen-space sharpen effect.
 * @beta
 */
export class SharpenEffect extends ConvolutionEffect {
  public static toolId = "SharpenEffect";
  protected get kernelName(): KernelName { return "sharpen"; }
}

/** Toggles a screen-space sharpness effect.
 * @beta
 */
export class SharpnessEffect extends ConvolutionEffect {
  public static toolId = "SharpnessEffect";
  protected get kernelName(): KernelName { return "sharpness"; }
}

/** Toggles a screen-space edge-detection effect.
 * @beta
 */
export class EdgeDetectionEffect extends ConvolutionEffect {
  public static toolId = "EdgeDetectionEffect";
  protected get kernelName(): KernelName { return "edgeDetect"; }
}

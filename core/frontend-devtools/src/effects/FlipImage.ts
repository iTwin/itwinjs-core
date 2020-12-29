/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */

import { assert } from "@bentley/bentleyjs-core";
import { IModelApp, Tool, UniformType, VaryingType } from "@bentley/imodeljs-frontend";
import { parseArgs } from "../tools/parseArgs";

let effectRegistered = false;
let flipHorizontal = false;
let flipVertical = false;
let flipColor = false;

function shouldApplyEffect(): boolean {
  return flipHorizontal || flipVertical || flipColor;
}

function registerEffect(): void {
  if (effectRegistered || !shouldApplyEffect())
    return;

  effectRegistered = true;
  const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder({
    name: "fdt flip image",
    textureCoordFromPosition: true,
    source: {
      // Compute texture coordinate for use in fragment shader.
      vertex: `
        void effectMain(vec4 pos) {
          vec2 uv = textureCoordFromPosition(pos);
          if (u_flipHorizontal)
            uv.x = 1.0 - uv.x;

          if (u_flipVertical)
            uv.y = 1.0 - uv.y;

          v_uv = uv;
        }`,
      // Sample the original image to flip on x and/or y axis, then invert its color.
      fragment: `
        vec4 effectMain() {
          vec4 color = sampleSourcePixel();
          if (u_flipColor) {
            color.r = 1.0 - color.r;
            color.g = 1.0 - color.g;
            color.b = 1.0 - color.b;
          }

          return color;
        }`,
      // Because we're moving pixels around, we must tell the render system where the source pixel was originally located - otherwise
      // element locate will not work correctly.
      sampleSourcePixel: "return TEXTURE(u_diffuse, v_uv);",
    },
  });

  // Don't bother applying the effect if we're not flipping on either axis - resultant image would be unchanged.
  assert(undefined !== builder);
  builder.shouldApply = (_context) => shouldApplyEffect();

  // Hook up the uniforms.
  builder.addUniform({
    name: "u_flipHorizontal",
    type: UniformType.Bool,
    bind: (uniform, _context) => uniform.setUniform1i(flipHorizontal ? 1 : 0),
  });
  builder.addUniform({
    name: "u_flipVertical",
    type: UniformType.Bool,
    bind: (uniform, _context) => uniform.setUniform1i(flipVertical ? 1 : 0),
  });
  builder.addUniform({
    name: "u_flipColor",
    type: UniformType.Bool,
    bind: (uniform, _context) => uniform.setUniform1i(flipColor ? 1 : 0),
  });

  // Define the varying for the texture coordinate.
  builder.addVarying("v_uv", VaryingType.Vec2);

  // Compile and register the effect shader.
  builder.finish();
}

/** An extremely simple and mostly useless effect intended to demonstrate the basics of creating a screen-space effect.
 * It flips the Viewport's image on the x and/or y axis, and/or inverts the color of each pixel.
 * Key-in: `fdt effect flip horizontal=0|1 vertical=0|1 color=0|1`
 * @beta
 */
export class FlipImageEffect extends Tool {
  public static toolId = "FlipImageEffect";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 3; }

  public run(): boolean {
    return true;
  }

  public parseAndRun(...input: string[]): boolean {
    const args = parseArgs(input);
    flipHorizontal = true === args.getBoolean("h");
    flipVertical = true === args.getBoolean("v");
    flipColor = true === args.getBoolean("c");
    registerEffect();

    // Ensure all viewports are re-rendered to reflect the changed effect parameters.
    IModelApp.viewManager.invalidateViewportScenes();
    return true;
  }
}

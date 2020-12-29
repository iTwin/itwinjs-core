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

function shouldApplyEffect(): boolean {
  return flipHorizontal || flipVertical;
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
      // Sample the original image to flip on x and/or y axis.
      fragment: `
        vec4 effectMain() {
          return TEXTURE(u_diffuse, v_uv);
        }`,
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

  // Define the varying for the texture coordinate.
  builder.addVarying("v_uv", VaryingType.Vec2);

  // Compile and register the effect shader.
  builder.finish();
}

/** An extremely simple and mostly useless effect that flips the viewport's image horizontally and/or vertically, intended to demonstrate the basics of creating a screen-space effect.
 * Key-in: `fdt effect flip horizontal=0|1 vertical=0|1`
 * @beta
 */
export class FlipImageEffect extends Tool {
  public static toolId = "FlipImageEffect";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 2; }

  public run(): boolean {
    return true;
  }

  public parseAndRun(...input: string[]): boolean {
    const args = parseArgs(input);
    flipHorizontal = true === args.getBoolean("h");
    flipVertical = true === args.getBoolean("v");
    registerEffect();

    // Ensure all viewports are re-rendered to reflect the changed effect parameters.
    IModelApp.viewManager.invalidateViewportScenes();
    return true;
  }
}

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

/** A screen-space effect used to simulate the lens distortion produced by real-world cameras with very wide fields of view.
 * Based on https://www.decarpentier.nl/lens-distortion
 * Key-in: `fdt effect lens distortion strength=[0..1] ratio=[0..1]`
 * The effect is improved considerably by enabling anti-aliasing (e.g., via [RenderSystem.Options.antialiasSamples]($frontend) at startup, or using the `fdt aasamples` key-in`).
 * @beta
 */
export class LensDistortionEffect extends Tool {
  public static toolId = "LensDistortionEffect";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 2; }

  private static _registered = false;
  private static _strength = 0.5;
  private static _cylindricalRatio = 0.5;

  public run(): boolean {
    // Ensure the effect has been registered.
    LensDistortionEffect.registerEffect();

    // Ensure all viewports are re-rendered to reflect the changed effect parameters.
    IModelApp.viewManager.invalidateViewportScenes();
    return true;
  }

  public parseAndRun(...input: string[]): boolean {
    const args = parseArgs(input);
    const extractArg = (name: string) => {
      const value = args.getFloat(name);
      return undefined !== value ? Math.max(0, Math.min(1, value)) : undefined;
    };

    const strength = extractArg("s");
    if (undefined !== strength)
      LensDistortionEffect._strength = strength;

    const ratio = extractArg("r");
    if (undefined !== ratio)
      LensDistortionEffect._cylindricalRatio = ratio;

    return this.run();
  }

  private static registerEffect(): void {
    if (this._registered)
      return;

    this._registered = true;

    const vertex = `
      void effectMain(vec4 position) {
        vec2 uv = textureCoordFromPosition(position);
        float scaledHeight = strength * height;
        float cylAspectRatio = aspectRatio * cylindricalRatio;
        float aspectDiagSq = aspectRatio * aspectRatio + 1.0;
        float diagSq = scaledHeight * scaledHeight * aspectDiagSq;
        vec2 signedUV = (2.0 * uv + vec2(-1.0, -1.0));

        float z = 0.5 * sqrt(diagSq + 1.0) + 0.5;
        float ny = (z - 1.0) / (cylAspectRatio * cylAspectRatio + 1.0);

        vUVDot = sqrt(ny) * vec2(cylAspectRatio, 1.0) * signedUV;
        vUV = vec3(0.5, 0.5, 1.0) * z + vec3(-0.5, -0.5, 0.0);
        vUV.xy += uv;
      }`;

    // We simply shift pixels, we don't alter their colors.
    const fragment = `
      vec4 effectMain() {
        return sampleSourcePixel();
      }`;

    // Because we're moving pixels around, we must tell the render system where the source pixel was originally located - otherwise
    // element locate will not work correctly.
    const sampleSourcePixel = `
      vec3 uv = dot(vUVDot, vUVDot) * vec3(-0.5, -0.5, -1.0) + vUV;
      return TEXTURE_PROJ(u_diffuse, uv);
    `;

    const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder({
      name: "fdt lens distortion",
      textureCoordFromPosition: true,
      source: {
        vertex,
        fragment,
        sampleSourcePixel,
      },
    });

    // Lens distortion only applicable to views with camera enabled.
    assert(undefined !== builder);
    builder.shouldApply = (context) => context.viewport.isCameraOn;

    builder.addVarying("vUV", VaryingType.Vec3);
    builder.addVarying("vUVDot", VaryingType.Vec2);

    builder.addUniform({
      name: "strength",
      type: UniformType.Float,
      bind: (uniform) => uniform.setUniform1f(this._strength),
    });
    builder.addUniform({
      name: "cylindricalRatio",
      type: UniformType.Float,
      bind: (uniform) => uniform.setUniform1f(this._cylindricalRatio),
    });
    builder.addUniform({
      name: "aspectRatio",
      type: UniformType.Float,
      bind: (uniform, context) => uniform.setUniform1f(context.viewport.viewRect.aspect),
    });
    builder.addUniform({
      name: "height",
      type: UniformType.Float,
      bind: (uniform, context) => {
        assert(context.viewport.view.isCameraEnabled());
        const fov = context.viewport.view.camera.lens.radians;
        const height = Math.tan(fov / 2) / context.viewport.viewRect.aspect;
        uniform.setUniform1f(height);
      },
    });

    // Compile and register the effect shader.
    builder.finish();
  }
}

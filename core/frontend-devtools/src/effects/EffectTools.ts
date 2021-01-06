/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */

import { assert } from "@bentley/bentleyjs-core";
import {
  IModelApp, ScreenSpaceEffectBuilder, ScreenSpaceEffectSource, Tool,
} from "@bentley/imodeljs-frontend";

/** Requests that the selected viewport redraw on the next frame. Useful after changing the configuration of a screen-space effect.
 * @beta
 */
export function redrawSelectedView(): void {
  IModelApp.viewManager.selectedView?.requestRedraw();
}

/** Adds a screen-space effect to the selected viewport.
 * @beta
 */
export abstract class AddEffectTool extends Tool {
  private static readonly _registeredEffects = new Set<string>();

  /** Name of effect as used in keyins like `fdt effect add`. Ideally one word. */
  protected abstract get effectName(): string;
  /** vertex, fragment, and optional sampleSourcePixel GLSL snippets. */
  protected abstract get source(): ScreenSpaceEffectSource;
  /** Whether the fragment shader should include built-in `textureCoordFromPosition` function. */
  protected abstract get textureCoordFromPosition(): boolean;
  /** Add uniforms, varyings, etc. */
  protected abstract defineEffect(builder: ScreenSpaceEffectBuilder): void;

  public run(): boolean {
    // Avoid conflicts with the names of other registered screen-space effects.
    const name = `fdt ${this.effectName}`;
    if (!AddEffectTool._registeredEffects.has(name)) {
      // Register the effect.
      const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder({
        name,
        textureCoordFromPosition: this.textureCoordFromPosition,
        source: this.source,
      });

      assert(undefined !== builder);
      this.defineEffect(builder);
      builder.finish();

      AddEffectTool._registeredEffects.add(name);
    }

    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      vp.addScreenSpaceEffect(name);

    return true;
  }
}

/** Removes all screen-space effects from the selected viewport.
 * @beta
 */
export class ClearEffectsTool extends Tool {
  public static toolId = "ClearEffects";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    IModelApp.viewManager.selectedView?.removeScreenSpaceEffects();
    return true;
  }
}

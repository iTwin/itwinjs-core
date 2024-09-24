/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, describe, expect, it } from "vitest";
import { Capabilities } from "@itwin/webgl-compatibility";
import { RenderSystem } from "../../../render/RenderSystem";
import { IModelApp } from "../../../IModelApp";
import { CompileStatus, ShaderProgram } from "../../../render/webgl/ShaderProgram";
import { System } from "../../../render/webgl/System";
import { EmptyLocalization } from "@itwin/core-common";

class TestSystem extends System {
  private static _simulateBug = true;

  protected constructor(canvas: HTMLCanvasElement, context: WebGL2RenderingContext, capabilities: Capabilities, options: RenderSystem.Options) {
    capabilities.driverBugs.fragDepthDoesNotDisableEarlyZ = TestSystem._simulateBug ? true : undefined;
    super(canvas, context, capabilities, options);
  }

  public static async startIModelApp(simulateBug: boolean): Promise<void> {
    this._simulateBug = simulateBug;
    return IModelApp.startup({
      renderSys: this.create({ preserveShaderSourceCode: true }),
      localization: new EmptyLocalization(),
    });
  }
}

function containsDiscardStatement(program: ShaderProgram): boolean {
  return -1 !== program.fragSource.indexOf("discard;");
}

function containsWorkaround(program: ShaderProgram): boolean {
  const workaround = "if (v_eyeSpace.z == 9999999.0) discard;";
  return -1 !== program.fragSource.indexOf(workaround);
}

describe("Early Z driver bug workaround", () => {
  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("applies to shaders lacking discard statements when buggy driver is detected", { timeout: 95000 }, async () => {
    // Figure out which shaders the workaround should apply to.
    await TestSystem.startIModelApp(false);
    const indicesOfShadersLackingDiscard: number[] = [];
    let index = 0;
    TestSystem.instance.techniques.forEachVariedProgram((program: ShaderProgram) => {
      expect(containsWorkaround(program)).toBe(false);
      if (!containsDiscardStatement(program))
        indicesOfShadersLackingDiscard.push(index);

      ++index;
    });

    expect(indicesOfShadersLackingDiscard.length === 0).toBe(false);

    // Now simulate the bug and confirm (1) workaround applied *only* to shaders that require it and (2) those shaders compile cleanly.
    await IModelApp.shutdown();
    await TestSystem.startIModelApp(true);
    index = 0;
    TestSystem.instance.techniques.forEachVariedProgram((program: ShaderProgram) => {
      expect(containsDiscardStatement(program)).toBe(true);
      const needsWorkaround = -1 !== indicesOfShadersLackingDiscard.indexOf(index);
      expect(containsWorkaround(program)).toEqual(needsWorkaround);
      if (needsWorkaround)
        expect(program.compile()).toEqual(CompileStatus.Success);

      index++;
    });
  });
});

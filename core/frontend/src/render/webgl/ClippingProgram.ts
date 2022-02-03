/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose } from "@itwin/core-bentley";
import type { ProgramBuilder } from "./ShaderBuilder";
import type { ShaderProgram } from "./ShaderProgram";
import { CompileStatus } from "./ShaderProgram";
import { System } from "./System";
import { addClipping } from "./glsl/Clipping";

function createClippingBuilder(src: ProgramBuilder, isWebGL2: boolean): ProgramBuilder {
  const builder = src.clone();
  builder.vert.headerComment += "-Clip";
  builder.frag.headerComment += "-Clip";
  addClipping(builder, isWebGL2);
  return builder;
}

/** @internal */
export abstract class ClippingProgram {
  protected _program?: ShaderProgram;

  public abstract getProgram(numPlanes: number): ShaderProgram | undefined;
  public compile(): boolean {
    return undefined === this._program || CompileStatus.Success === this._program.compile();
  }

  public dispose(): void {
    this._program = dispose(this._program);
  }
}

/** WebGL 1 requires that the loop variable be a compile-time constant. If caller requests a number of planes greater than the maximum our current program
 * supports, recompile the program with sufficient maximum number of planes.
 */
class WebGL1ClippingProgram extends ClippingProgram {
  private _builder: ProgramBuilder;
  private _maxClippingPlanes = 0;

  public constructor(src: ProgramBuilder) {
    super();
    this._builder = createClippingBuilder(src, false);
  }

  public getProgram(numPlanes: number): ShaderProgram | undefined {
    if (numPlanes <= 0)
      return undefined;

    if (!this._program || this._maxClippingPlanes < numPlanes) {
      this._program?.endUse();
      this.dispose();
      this._builder.frag.addDefine("MAX_CLIPPING_PLANES", numPlanes.toString());
      this._program = this._builder.buildProgram(System.instance.context);
      this._maxClippingPlanes = numPlanes;
    }

    return this._program;
  }
}

/** WebGL 2 permits looping on a uniform. */
class WebGL2ClippingProgram extends ClippingProgram {
  public constructor(src: ProgramBuilder) {
    super();
    const builder = createClippingBuilder(src, true);
    this._program = builder.buildProgram(System.instance.context);
  }

  public getProgram(numPlanes: number): ShaderProgram | undefined {
    return numPlanes > 0 ? this._program : undefined;
  }
}

/** @internal */
export function createClippingProgram(builder: ProgramBuilder): ClippingProgram {
  return System.instance.isWebGL2 ? new WebGL2ClippingProgram(builder) : new WebGL1ClippingProgram(builder);
}

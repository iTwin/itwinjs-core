/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose } from "@itwin/core-bentley";
import { ProgramBuilder } from "./ShaderBuilder.js";
import { CompileStatus, ShaderProgram } from "./ShaderProgram.js";
import { System } from "./System.js";
import { addClipping } from "./glsl/Clipping.js";

function createClippingBuilder(src: ProgramBuilder): ProgramBuilder {
  const builder = src.clone();
  builder.vert.headerComment += "-Clip";
  builder.frag.headerComment += "-Clip";
  addClipping(builder);
  return builder;
}

/** @internal */
export class ClippingProgram {
  protected _program?: ShaderProgram;

  public compile(): boolean {
    return undefined === this._program || CompileStatus.Success === this._program.compile();
  }

  public constructor(src: ProgramBuilder) {
    const builder = createClippingBuilder(src);
    this._program = builder.buildProgram(System.instance.context);
  }

  public getProgram(numPlanes: number): ShaderProgram | undefined {
    return numPlanes > 0 ? this._program : undefined;
  }

  public [Symbol.dispose](): void {
    this._program = dispose(this._program);
  }

  /** @deprecated in 5.0 Use [Symbol.dispose] instead. */
  public dispose(): void {
    this[Symbol.dispose]();
  }
}

/** @internal */
export function createClippingProgram(builder: ProgramBuilder): ClippingProgram {
  return new ClippingProgram(builder);
}

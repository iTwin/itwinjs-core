/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";
import { UniformHandle, AttributeHandle } from "./Handle";
import { ShaderProgramParams, DrawParams } from "./DrawCommand";
import { GLDisposable } from "./GLDisposable";

/** Describes the location of a uniform variable within a shader program. */
export class Uniform {
  private readonly _name: string;
  protected _handle?: UniformHandle;

  protected constructor(name: string) { this._name = name; }

  public compile(gl: WebGLRenderingContext, prog: ShaderProgram): boolean {
    assert(!this.isValid);
    if (undefined !== prog.glProgram) {
      this._handle = UniformHandle.create(gl, prog.glProgram, this._name, true);
    }

    return this.isValid;
  }

  public get isValid(): boolean { return undefined !== this._handle; }
}

/**
 * A function associated with a ProgramUniform which is invoked each time the shader program becomes active.
 * The function is responsible for setting the value of the uniform.
 */
export type BindProgramUniform = (uniform: UniformHandle, params: ShaderProgramParams) => void;

/**
 * Describes the location of a uniform variable within a shader program, the value of which does not change while the program is active.
 * The supplied binding function will be invoked once each time the shader becomes active to set the value of the uniform.
 */
export class ProgramUniform extends Uniform {
  private readonly _bind: BindProgramUniform;

  public constructor(name: string, bind: BindProgramUniform) {
    super(name);
    this._bind = bind;
  }

  public bind(params: ShaderProgramParams): void {
    if (undefined !== this._handle) {
      this._bind(this._handle, params);
    }
  }
}

/**
 * A function associated with a GraphicUniform which is invoked each time a new graphic primitive is rendered using the associated shader.
 * The function is responsible for setting the value of the uniform.
 */
export type BindGraphicUniform = (uniform: UniformHandle, params: DrawParams) => void;

/**
 * Describes the location of a uniform variable within a shader program, the value of which is dependent upon the graphic primitive
 * currently being rendered by the program. The supplied binding function will be invoked once for each graphic primitive submitted
 * to the program to set the value of the uniform.
 */
export class GraphicUniform extends Uniform {
  private readonly _bind: BindGraphicUniform;

  public constructor(name: string, bind: BindGraphicUniform) {
    super(name);
    this._bind = bind;
  }

  public bind(params: DrawParams): void {
    if (undefined !== this._handle) {
      this._bind(this._handle, params);
    }
  }
}

/** A function associated with an Attribute which is invoked to bind the attribute data. */
export type BindAttribute = (attr: AttributeHandle, params: DrawParams) => void;

/** Describes the location of an attribute within a shader program along with a function for binding the attribute's data */
export class Attribute {
  private readonly _name: string;
  private readonly _bind: BindAttribute;
  private _handle?: AttributeHandle;

  public constructor(name: string, bind: BindAttribute) {
    this._name = name;
    this._bind = bind;
  }

  public compile(gl: WebGLRenderingContext, prog: ShaderProgram): boolean {
    assert(!this.isValid);
    if (undefined !== prog.glProgram) {
      this._handle = AttributeHandle.create(gl, prog.glProgram, this._name, true);
    }

    return this.isValid;
  }

  public get isValid(): boolean { return undefined !== this._handle; }
  public bind(params: DrawParams): void {
    if (undefined !== this._handle) {
      this._bind(this._handle, params);
    }
  }
}

/** Describes the compilation status of a shader program. Programs may be compiled during idle time, or upon first use. */
export const enum CompileStatus {
  Success,    // The program was successfully compiled.
  Failure,    // The program failed to compile.
  Uncompiled, // No attempt has yet been made to compile the program.
}

export class ShaderProgram implements GLDisposable {
  private _description: string; // for debugging purposes...
  private _vertSource: string;
  private _fragSource: string;
  private _glProgram?: WebGLProgram;
  private _inUse: boolean = false;
  private _status: CompileStatus = CompileStatus.Uncompiled;

  public constructor(vertSource: string, fragSource: string, description: string, gl: WebGLRenderingContext) {
    this._description = description;
    this._vertSource = vertSource;
    this._fragSource = fragSource;

    const glProgram = gl.createProgram();
    this._glProgram = (null === glProgram) ? undefined : glProgram;

    // ###TODO: Silencing 'unused variable' warnings temporarily...
    assert(undefined !== this._description);
    assert(undefined !== this._vertSource);
    assert(undefined !== this._fragSource);
    assert(CompileStatus.Uncompiled === this._status);
  }

  public dispose(gl: WebGLRenderingContext): void {
    if (undefined !== this.glProgram) {
      assert(!this._inUse);
      gl.deleteProgram(this.glProgram);
      this._glProgram = undefined;
      this._status = CompileStatus.Uncompiled;
    }
  }

  public get isValid(): boolean { return undefined !== this.glProgram; }
  public get glProgram(): WebGLProgram | undefined { return this._glProgram; }
}

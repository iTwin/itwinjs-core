/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, IDisposable } from "@bentley/bentleyjs-core";
import {UniformHandle, AttributeHandle } from "./Handle";

export type BindProgramUniform = (uniform: UniformHandle, params: ShaderProgramParams) => void;

export class ShaderProgramParams { }
export class DrawParams extends ShaderProgramParams { }

export class UniformLocation {
  private readonly _name: string;
  protected readonly _handle = new UniformHandle();

  protected constructor(name: string) { this._name = name; }

  public compile(prog: ShaderProgram): boolean {
    assert(!this.isValid);
    if (undefined !== prog.glProgram) {
      this._handle.init(prog.gl, prog.glProgram, this._name, true);
    }
    return this.isValid;
  }

  public get isValid(): boolean { return this._handle.isValid; }
}

export class ProgramUniform extends UniformLocation {
  private readonly _bind: BindProgramUniform;

  public constructor(name: string, bind: BindProgramUniform) {
    super(name);
    this._bind = bind;
  }

  public bind(params: ShaderProgramParams): void { this._bind(this._handle, params); }
}

export type BindGraphicUniform = (uniform: UniformHandle, params: DrawParams) => void;

export class GraphicUniform extends UniformLocation {
  private readonly _bind: BindGraphicUniform;

  public constructor(name: string, bind: BindGraphicUniform) {
    super(name);
    this._bind = bind;
  }

  public bind(params: DrawParams): void { this._bind(this._handle, params); }
}

export type BindAttribute = (attr: AttributeHandle, params: DrawParams) => void;

export class AttributeLocation {
  private readonly _name: string;
  private readonly _bind: BindAttribute;
  private readonly _handle = new AttributeHandle();

  public constructor(name: string, bind: BindAttribute) {
    this._name = name;
    this._bind = bind;
  }

  public compile(prog: ShaderProgram): boolean {
    assert(!this.isValid);
    if (undefined !== prog.glProgram) {
      this._handle.init(prog.gl, prog.glProgram, this._name, true);
    }
    return this.isValid;
  }

  public get isValid(): boolean { return this._handle.isValid; }
  public bind(params: DrawParams): void { this._bind(this._handle, params); }
}

export const enum CompileStatus {
  Success,
  Failure,
  Uncompiled,
}

export class ShaderProgram implements IDisposable {
  private _description: string;
  private _vertSource: string;
  private _fragSource: string;
  private _glProgram: WebGLProgram | undefined;
  private _inUse: boolean = false;
  private _status: CompileStatus = CompileStatus.Uncompiled;
  private _gl: WebGLRenderingContext;

  public constructor(vertSource: string, fragSource: string, description: string, gl: WebGLRenderingContext) {
    this._description = description;
    this._vertSource = vertSource;
    this._fragSource = fragSource;
    this._gl = gl;

    // ###TODO: Silencing 'unused variable' warnings temporarily...
    assert(undefined !== this._description);
    assert(undefined !== this._vertSource);
    assert(undefined !== this._fragSource);
    assert(undefined === this._glProgram);
    assert(!this._inUse);
    assert(CompileStatus.Uncompiled === this._status);
  }

  public dispose(): void {
    if (undefined !== this.glProgram) {
      assert(!this._inUse);
      this.gl.deleteProgram(this.glProgram);
      this._glProgram = undefined;
      this._status = CompileStatus.Uncompiled;
    }
  }

  public get isValid(): boolean { return undefined !== this.glProgram; }
  public get glProgram(): WebGLProgram | undefined { return this._glProgram; }
  public get gl(): WebGLRenderingContext { return this._gl; }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import { UniformHandle } from "./Handle";
import { ShaderProgramParams, DrawParams } from "./DrawCommand";
import { GL } from "./GL";
import { Target } from "./Target";
import { RenderPass } from "./RenderFlags";
import { TechniqueFlags } from "./TechniqueFlags";
import { System } from "./System";
import { Branch, Batch } from "./Graphic";
import { AttributeDetails } from "./AttributeMap";
import { WebGLDisposable } from "./Disposable";

// tslint:disable:no-const-enum

/** Flags which control some conditional branches in shader code
 * @internal
 */
export const enum ShaderFlags {
  None = 0,
  Monochrome = 1 << 0,
  NonUniformColor = 1 << 1,
  OITFlatAlphaWeight = 1 << 2,
  OITScaleOutput = 1 << 3,
  IgnoreNonLocatable = 1 << 4,
}

/** Describes the location of a uniform variable within a shader program.
 * @internal
 */
export class Uniform {
  private readonly _name: string;
  protected _handle?: UniformHandle;

  protected constructor(name: string) { this._name = name; }

  public compile(prog: ShaderProgram): boolean {
    assert(!this.isValid);
    if (undefined !== prog.glProgram) {
      this._handle = UniformHandle.create(prog.glProgram, this._name);
    }

    return this.isValid;
  }

  public get isValid(): boolean { return undefined !== this._handle; }
}

/**
 * A function associated with a ProgramUniform which is invoked each time the shader program becomes active.
 * The function is responsible for setting the value of the uniform.
 * @internal
 */
export type BindProgramUniform = (uniform: UniformHandle, params: ShaderProgramParams) => void;

/**
 * Describes the location of a uniform variable within a shader program, the value of which does not change while the program is active.
 * The supplied binding function will be invoked once each time the shader becomes active to set the value of the uniform.
 * @internal
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
 * @internal
 */
export type BindGraphicUniform = (uniform: UniformHandle, params: DrawParams) => void;

/**
 * Describes the location of a uniform variable within a shader program, the value of which is dependent upon the graphic primitive
 * currently being rendered by the program. The supplied binding function will be invoked once for each graphic primitive submitted
 * to the program to set the value of the uniform.
 * @internal
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

/** Describes the compilation status of a shader program. Programs may be compiled during idle time, or upon first use.
 * @internal
 */
export const enum CompileStatus {
  Success,    // The program was successfully compiled.
  Failure,    // The program failed to compile.
  Uncompiled, // No attempt has yet been made to compile the program.
}

/** @internal */
export class ShaderProgram implements WebGLDisposable {
  private _description: string; // for debugging purposes...
  public vertSource: string;
  public fragSource: string;
  public readonly maxClippingPlanes: number;
  private _glProgram?: WebGLProgram;
  private _inUse: boolean = false;
  private _status: CompileStatus = CompileStatus.Uncompiled;
  private readonly _programUniforms = new Array<ProgramUniform>();
  private readonly _graphicUniforms = new Array<GraphicUniform>();
  private readonly _attrMap?: Map<string, AttributeDetails>;

  public constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, vertSource: string, fragSource: string, attrMap: Map<string, AttributeDetails> | undefined, description: string, maxClippingPlanes: number) {
    this._description = description;
    this.vertSource = vertSource;
    this.fragSource = fragSource;
    this._attrMap = attrMap;
    this.maxClippingPlanes = maxClippingPlanes;

    const glProgram = gl.createProgram();
    this._glProgram = (null === glProgram) ? undefined : glProgram;
  }

  public get isDisposed(): boolean { return this._glProgram === undefined; }

  public dispose(): void {
    if (!this.isDisposed) {
      assert(!this._inUse);
      System.instance.context.deleteProgram(this._glProgram!);
      this._glProgram = undefined;
      this._status = CompileStatus.Uncompiled;
    }
  }

  public get glProgram(): WebGLProgram | undefined { return this._glProgram; }
  public get isUncompiled() { return CompileStatus.Uncompiled === this._status; }
  public get isCompiled() { return CompileStatus.Success === this._status; }

  private compileShader(type: GL.ShaderType): WebGLShader | undefined {
    const gl = System.instance.context;

    const shader = gl.createShader(type);
    if (null === shader)
      return undefined;

    const src = GL.ShaderType.Vertex === type ? this.vertSource : this.fragSource;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    const succeeded = gl.getShaderParameter(shader, GL.ShaderParameter.CompileStatus) as boolean;
    if (!succeeded) {
      const compileLog = (GL.ShaderType.Vertex === type ? "Vertex" : "Fragment") + " shader failed to compile. Errors: " + gl.getShaderInfoLog(shader) + " Program description: " + this._description;
      throw new Error(compileLog);
    }

    return shader;
  }
  private linkProgram(vert: WebGLShader, frag: WebGLShader): boolean {
    assert(undefined !== this.glProgram);
    if (undefined === this._glProgram || null === this._glProgram) // because WebGL APIs used Thing|null, not Thing|undefined...
      return false;

    const gl = System.instance.context;
    gl.attachShader(this._glProgram, vert);
    gl.attachShader(this._glProgram, frag);

    // bind attribute locations before final linking
    if (this._attrMap !== undefined) {
      this._attrMap.forEach((attr: AttributeDetails, key: string) => {
        gl.bindAttribLocation(this._glProgram!, attr.location, key);
      });
    }

    gl.linkProgram(this._glProgram);

    const linkLog = gl.getProgramInfoLog(this._glProgram);
    gl.validateProgram(this._glProgram);

    const succeeded = gl.getProgramParameter(this._glProgram, GL.ProgramParameter.LinkStatus) as boolean;
    if (!succeeded) {
      const validateLog = gl.getProgramInfoLog(this._glProgram);
      const msg = "Shader program failed to link. Link errors: " + linkLog + " Validation errors: " + validateLog + " Program description: " + this._description;
      throw new Error(msg);
    }

    return true;
  }
  public compile(): CompileStatus {
    switch (this._status) {
      case CompileStatus.Failure: return CompileStatus.Failure;
      case CompileStatus.Success: return CompileStatus.Success;
      default: {
        if (this.isDisposed) {
          this._status = CompileStatus.Failure;
          return CompileStatus.Failure;
        }
        break;
      }
    }

    this._status = CompileStatus.Failure;

    const vert = this.compileShader(GL.ShaderType.Vertex);
    const frag = this.compileShader(GL.ShaderType.Fragment);
    if (undefined !== vert && undefined !== frag)
      if (this.linkProgram(vert, frag) && this.compileUniforms(this._programUniforms) && this.compileUniforms(this._graphicUniforms))
        this._status = CompileStatus.Success;

    if (true !== System.instance.options.preserveShaderSourceCode)
      this.vertSource = this.fragSource = "";

    return this._status;
  }

  public use(params: ShaderProgramParams): boolean {
    if (this.compile() !== CompileStatus.Success) {
      return false;
    }

    assert(undefined !== this._glProgram);
    if (null === this._glProgram || undefined === this._glProgram) {
      return false;
    }

    assert(!this._inUse);
    this._inUse = true;
    params.context.useProgram(this._glProgram);

    for (const uniform of this._programUniforms) {
      uniform.bind(params);
    }

    return true;
  }
  public endUse() {
    this._inUse = false;
    System.instance.context.useProgram(null);
  }

  public draw(params: DrawParams): void {
    assert(this._inUse);
    for (const uniform of this._graphicUniforms) {
      uniform.bind(params);
    }

    params.geometry.draw();
  }

  public addProgramUniform(name: string, binding: BindProgramUniform) {
    assert(this.isUncompiled);
    this._programUniforms.push(new ProgramUniform(name, binding));
  }
  public addGraphicUniform(name: string, binding: BindGraphicUniform) {
    assert(this.isUncompiled);
    this._graphicUniforms.push(new GraphicUniform(name, binding));
  }

  private compileUniforms<T extends Uniform>(uniforms: T[]): boolean {
    for (const uniform of uniforms) {
      if (!uniform.compile(this))
        return false;
    }

    return true;
  }
}

/** Context in which ShaderPrograms are executed. Avoids switching shaders unnecessarily.
 * Ensures shader programs are compiled before use and un-bound when scope is disposed.
 * This class must *only* be used inside a using() function!
 * @internal
 */
export class ShaderProgramExecutor {
  private _program?: ShaderProgram;
  private static _params?: ShaderProgramParams;

  public constructor(target: Target, pass: RenderPass, program?: ShaderProgram) {
    this.params.init(target, pass);
    this.changeProgram(program);
  }

  public static freeParams(): void {
    this._params = undefined;
  }

  private _isDisposed = false;
  public get isDisposed(): boolean { return this._isDisposed; }

  /** Clears the current program to be executed. This does not free WebGL resources, since those are owned by Techniques. */
  public dispose() {
    this.changeProgram(undefined);
    ShaderProgramExecutor.freeParams();
    this._isDisposed = true;
  }

  public setProgram(program: ShaderProgram): boolean { return this.changeProgram(program); }
  public get isValid() { return undefined !== this._program; }
  public get target() { return this.params.target; }
  public get renderPass() { return this.params.renderPass; }
  public get params() {
    if (undefined === ShaderProgramExecutor._params)
      ShaderProgramExecutor._params = new ShaderProgramParams();

    return ShaderProgramExecutor._params;
  }

  public draw(params: DrawParams) {
    assert(this.isValid);
    if (undefined !== this._program) {
      this._program.draw(params);
    }
  }
  public drawInterrupt(params: DrawParams) {
    assert(params.target === this.params.target);

    const tech = params.target.techniques.getTechnique(params.geometry.techniqueId);
    const program = tech.getShader(TechniqueFlags.defaults);
    if (this.setProgram(program)) {
      this.draw(params);
    }
  }

  public pushBranch(branch: Branch): void { this.target.pushBranch(this, branch); }
  public popBranch(): void { this.target.popBranch(); }
  public pushBatch(batch: Batch): void { this.target.pushBatch(batch); }
  public popBatch(): void { this.target.popBatch(); }

  private changeProgram(program?: ShaderProgram): boolean {
    if (this._program === program) {
      return true;
    } else if (undefined !== this._program) {
      this._program.endUse();
    }

    this._program = program;
    if (undefined !== program && !program.use(this.params)) {
      this._program = undefined;
      return false;
    }

    return true;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import { WebGLContext } from "@bentley/webgl-compatibility";
import { DebugShaderFile } from "../RenderSystem";
import { AttributeDetails } from "./AttributeMap";
import { WebGLDisposable } from "./Disposable";
import { DrawParams, ShaderProgramParams } from "./DrawCommand";
import { GL } from "./GL";
import { Batch, Branch } from "./Graphic";
import { UniformHandle } from "./UniformHandle";
import { RenderPass } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { TechniqueFlags } from "./TechniqueFlags";

/* eslint-disable no-restricted-syntax */

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
  public vertSource: string;
  public fragSource: string;
  private _glProgram?: WebGLProgram;
  private _inUse: boolean = false;
  private _status: CompileStatus = CompileStatus.Uncompiled;
  private readonly _programUniforms = new Array<ProgramUniform>();
  private readonly _graphicUniforms = new Array<GraphicUniform>();
  private readonly _attrMap?: Map<string, AttributeDetails>;
  // for debugging purposes...
  private _description: string;
  private _fragDescription: string;
  private _vertGNdx: number = -1;
  private _fragGNdx: number = -1;
  private _vertHNdx: number = -1;
  private _fragHNdx: number = -1;

  public constructor(gl: WebGLContext, vertSource: string, fragSource: string, attrMap: Map<string, AttributeDetails> | undefined, description: string, fragDescription: string) {
    this._description = description;
    this._fragDescription = fragDescription;
    this.vertSource = vertSource;
    this.fragSource = fragSource;
    this._attrMap = attrMap;

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
      const compileLog = `${GL.ShaderType.Vertex === type ? "Vertex" : "Fragment"} shader failed to compile. Errors: ${gl.getShaderInfoLog(shader)} Program description: ${this._description}`;
      throw new Error(compileLog);
    }

    if (System.instance.options.debugShaders) {
      const isVS = GL.ShaderType.Vertex === type;
      const desc = isVS ? this._description : this._fragDescription;
      this.saveShaderCode(isVS, desc, src, shader);
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
      const msg = `Shader program failed to link. Link errors: ${linkLog} Validation errors: ${validateLog} Program description: ${this._description}`;
      throw new Error(msg);
    }

    return true;
  }

  public compile(forUse: boolean = false): CompileStatus {
    if (System.instance.options.debugShaders && forUse && this._status === CompileStatus.Success)
      this.setDebugShaderUsage();

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

    if (System.instance.options.debugShaders && forUse && this._status === CompileStatus.Success)
      this.setDebugShaderUsage();

    if (true !== System.instance.options.preserveShaderSourceCode)
      this.vertSource = this.fragSource = "";

    return this._status;
  }

  public use(params: ShaderProgramParams): boolean {
    if (this.compile(true) !== CompileStatus.Success)
      return false;

    assert(undefined !== this._glProgram);
    if (null === this._glProgram || undefined === this._glProgram)
      return false;

    assert(!this._inUse);
    this._inUse = true;
    params.context.useProgram(this._glProgram);

    for (const uniform of this._programUniforms)
      uniform.bind(params);

    return true;
  }

  public endUse() {
    this._inUse = false;
    System.instance.context.useProgram(null);
  }

  public draw(params: DrawParams): void {
    assert(this._inUse);
    for (const uniform of this._graphicUniforms)
      uniform.bind(params);

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

  private setDebugShaderUsage() {
    if (!System.instance.options.debugShaders)
      return;

    const shaderFiles = System.instance.debugShaderFiles;
    if (this._vertGNdx >= 0)
      shaderFiles[this._vertGNdx].isUsed = true;

    if (this._fragGNdx >= 0)
      shaderFiles[this._fragGNdx].isUsed = true;

    if (this._vertHNdx >= 0)
      shaderFiles[this._vertHNdx].isUsed = true;

    if (this._fragHNdx >= 0)
      shaderFiles[this._fragHNdx].isUsed = true;
  }

  private saveShaderCode(isVS: boolean, desc: string, src: string, shader: WebGLShader) {
    // save glsl and hlsl (from Angle and fixed up) in DebugShaderFile
    if (!System.instance.options.debugShaders)
      return;

    const shaderFiles = System.instance.debugShaderFiles;
    let sname: string;
    if (desc) {
      sname = desc.split(isVS ? "//!V! " : "//!F! ").join("");
      sname = sname.split(": ").join("-");
      sname = sname.split("; ").join("-");
    } else {
      // need to investigate shaders with no comments to derive names, for now come up with unique name
      sname = `noname-${shaderFiles.length}`;
    }

    sname += isVS ? "_VS" : "_FS";
    const fname = `${sname}.glsl`;
    let dsfNdx = shaderFiles.push(new DebugShaderFile(fname, src, isVS, true, false));
    if (isVS)
      this._vertGNdx = dsfNdx - 1;
    else
      this._fragGNdx = dsfNdx - 1;

    const ext2 = System.instance.context.getExtension("WEBGL_debug_shaders");
    if (!ext2)
      return;

    const srcH = ext2.getTranslatedShaderSource(shader);
    if (!srcH)
      return;

    // TODO: implement WebGL2 specific inputs for gl_VertexID and gl_InstanceID if ever used

    // parse and edit srcH to make it compilable
    const fnameH = `${sname}.hlsl`;
    let numTargets = 0; // for gl_Color cases
    let haveGLpos = false;
    let haveGLpntsz = false;
    let haveGLDepth = false;
    let haveGLFrontFacing = false;
    let haveGLPointCoord = false;
    let haveGLFragCoord = false;
    let haveGLFragColorOnly = false; // for only 1 output
    const haveGLFragColor = [false, false, false, false, false, false, false, false];
    const attrs: string[] = new Array<string>();
    const varyings: string[] = new Array<string>();
    const lines = srcH.split("\n");
    let toss = true;
    for (let ndx = 0; ndx < lines.length;) {
      let line = lines[ndx];
      if (line.indexOf("// INITIAL HLSL END") >= 0)
        toss = true;

      if (toss)
        lines.splice(ndx, 1);

      if (line.indexOf("// INITIAL HLSL BEGIN") >= 0) {
        toss = false;
      } else if (!toss) { // look for lines that need editing
        if (line.indexOf("Varyings") >= 0) { // save off varyings in either case
          while (ndx + 1 < lines.length && lines[ndx + 1].indexOf("static") >= 0) {
            ++ndx;
            line = lines[ndx].substring(6).trimLeft();
            varyings.push(line.substring(0, line.indexOf("=")));
          }
        }

        if (isVS) {
          if (line.indexOf("Attributes") >= 0) { // save off attributes
            while (ndx + 1 < lines.length && lines[ndx + 1].indexOf("static") >= 0) {
              ++ndx;
              line = lines[ndx].substring(6).trimLeft();
              attrs.push(line.substring(0, line.indexOf("=")));
            }
          } else if (line.indexOf("static float4 gl_Position") >= 0) {
            haveGLpos = true;
          } else if (line.indexOf("static float gl_PointSize") >= 0) {
            haveGLpntsz = true;
          } else if (line.indexOf("@@ VERTEX ATTRIBUTES @@") >= 0) {
            lines[ndx] = "// @@ VERTEX ATTRIBUTES @@";
          } else if (line.indexOf("@@ MAIN PROLOGUE @@") >= 0) {
            lines[ndx] = "// @@ MAIN PROLOGUE @@\ngetInput(input);";
          } else if (line.indexOf("@@ VERTEX OUTPUT @@") >= 0) {
            // have to create a VS_OUTPUT struct and a generateOutput function from varyings
            lines[ndx] = "// @@ VERTEX OUTPUT @@\nstruct VS_INPUT\n  {";
            let aNdx = 0;
            for (const tstr of attrs) {
              ++ndx;
              lines.splice(ndx, 0, `  ${tstr}: TEXCOORD${aNdx};`);
              ++aNdx;
            }

            ++ndx;
            lines.splice(ndx, 0, "  };\nvoid getInput(VS_INPUT input) {");
            for (const tstr of attrs) {
              let t = tstr.indexOf("_a");
              let vName = tstr.substring(t);
              t = vName.indexOf(" ");
              vName = vName.substring(0, t);
              ++ndx;
              lines.splice(ndx, 0, `  ${vName} = input.${vName};`);
            }

            ++ndx;
            lines.splice(ndx, 0, "}\nstruct VS_OUTPUT\n  {");
            if (haveGLpos) {
              ++ndx;
              lines.splice(ndx, 0, "  float4 _v_position : SV_Position;");
            }

            if (haveGLpntsz) {
              ++ndx;
              lines.splice(ndx, 0, "  float gl_PointSize : PointSize;");
            }

            let vNdx = 0;
            for (const tstr of varyings) {
              ++ndx;
              lines.splice(ndx, 0, `  ${tstr}: TEXCOORD${vNdx};`);
              ++vNdx;
            }

            ++ndx;
            lines.splice(ndx, 0, "  };\nVS_OUTPUT generateOutput(VS_INPUT input) {\n  VS_OUTPUT output;");
            if (haveGLpos) {
              ++ndx;
              lines.splice(ndx, 0, "  output._v_position = gl_Position;");
            }

            if (haveGLpntsz) {
              ++ndx;
              lines.splice(ndx, 0, "  output.gl_PointSize = gl_PointSize;");
            }

            for (const tstr of varyings) {
              let t = tstr.indexOf("_v");
              let vName = tstr.substring(t);
              t = vName.indexOf(" ");
              vName = vName.substring(0, t);
              ++ndx;
              lines.splice(ndx, 0, `  output.${vName} = ${vName};`);
            }

            ++ndx;
            lines.splice(ndx, 0, "  return output;\n}");
          }
        } else { // fragment shader
          let tNdx = 0;
          if (line.indexOf("static float4 gl_Color[") >= 0) {
            //
          } else if (line.indexOf("gl_Color[0] =") >= 0) {
            if (numTargets < 1)
              numTargets = 1;
          } else if (line.indexOf("gl_Color[1] =") >= 0) {
            if (numTargets < 2)
              numTargets = 2;
          } else if (line.indexOf("gl_Color[2] =") >= 0) {
            if (numTargets < 3)
              numTargets = 3;
          } else if (line.indexOf("gl_Color[3] =") >= 0) {
            numTargets = 4;
          } else if (line.indexOf("gl_Depth") >= 0) {
            haveGLDepth = true;
          } else if (line.indexOf("gl_FrontFacing") >= 0) {
            haveGLFrontFacing = true;
          } else if (line.indexOf("gl_PointCoord") >= 0) {
            haveGLPointCoord = true;
          } else if (line.indexOf("gl_FragCoord") >= 0) {
            haveGLFragCoord = true;
          } else if ((tNdx = line.indexOf("out_FragColor")) >= 0) {
            const c = line.substr(tNdx + 13, 1);
            if (c === " " || c === "=")
              haveGLFragColorOnly = true;
            else {
              tNdx = +c;
              haveGLFragColor[tNdx] = true;
            }
          } else if (line.indexOf("@@ PIXEL OUTPUT @@") >= 0) {
            // have to create a VS_OUTPUT struct, a getInputs function (both from varyings),
            // a PS_OUTPUT struct, and a generateOutput function (both based on numTargets or haveGLFragColor)
            lines[ndx] = "// @@ PIXEL OUTPUT @@\nstruct VS_OUTPUT\n  {";
            if (haveGLFragCoord) {
              ++ndx;
              lines.splice(ndx, 0, "  float4 gl_FragCoord : SV_POSITION;");
            }

            let vNdx = 0;
            for (const tstr of varyings) {
              ++ndx;
              lines.splice(ndx, 0, `  ${tstr}: TEXCOORD${vNdx};`);
              ++vNdx;
            }

            if (haveGLFrontFacing) {
              ++ndx;
              lines.splice(ndx, 0, "  bool gl_FrontFacing : SV_IsFrontFace;");
            }

            if (haveGLPointCoord) {
              ++ndx;
              lines.splice(ndx, 0, "  float2 gl_PointCoord : PointCoord;");
            }

            ++ndx;
            lines.splice(ndx, 0, "  };\nvoid getInputs(VS_OUTPUT input) {");
            if (haveGLFragCoord) {
              ++ndx;
              lines.splice(ndx, 0, "  gl_FragCoord = input.gl_FragCoord;");
            }

            for (const tstr of varyings) {
              let t = tstr.indexOf("_v");
              let vName = tstr.substring(t);
              t = vName.indexOf(" ");
              vName = vName.substring(0, t);
              ++ndx;
              lines.splice(ndx, 0, `  ${vName} = input.${vName};`);
            }

            if (haveGLFrontFacing) {
              ++ndx;
              lines.splice(ndx, 0, "  gl_FrontFacing = input.gl_FrontFacing;");
            }

            if (haveGLPointCoord) {
              ++ndx;
              lines.splice(ndx, 0, "  gl_PointCoord = input.gl_PointCoord;");
            }

            ++ndx;
            lines.splice(ndx, 0, "}\nstruct PS_OUTPUT\n  {");
            let cNdx = 0;
            while (cNdx < numTargets) {
              ++ndx;
              lines.splice(ndx, 0, `  float4 col${cNdx} : SV_TARGET${cNdx};`);
              ++cNdx;
            }

            if (haveGLFragColorOnly) {
              ++ndx;
              lines.splice(ndx, 0, "  float4 out_FragColor : SV_TARGET;");
            } else {
              for (cNdx = 0; cNdx < haveGLFragColor.length; ++cNdx) {
                if (haveGLFragColor[cNdx]) {
                  ++ndx;
                  lines.splice(ndx, 0, `  float4 out_FragColor${cNdx} : SV_TARGET${cNdx};`);
                }
              }
            }

            if (haveGLDepth) {
              ++ndx;
              lines.splice(ndx, 0, "  float gl_Depth : SV_Depth;");
            }

            ++ndx;
            lines.splice(ndx, 0, "  };\nPS_OUTPUT generateOutput () {\n  PS_OUTPUT output;");
            cNdx = 0;
            while (cNdx < numTargets) {
              ++ndx;
              lines.splice(ndx, 0, `  output.col${cNdx} = gl_Color[${cNdx}];`);
              ++cNdx;
            }

            if (haveGLFragColorOnly) {
              ++ndx;
              lines.splice(ndx, 0, "  output.out_FragColor = out_FragColor;");
            } else {
              for (cNdx = 0; cNdx < haveGLFragColor.length; ++cNdx) {
                if (haveGLFragColor[cNdx]) {
                  ++ndx;
                  lines.splice(ndx, 0, `  output.out_FragColor${cNdx} = out_FragColor${cNdx};`);
                }
              }
            }

            if (haveGLDepth) {
              ++ndx;
              lines.splice(ndx, 0, "  output.gl_Depth = gl_Depth;");
            }

            ++ndx;
            lines.splice(ndx, 0, "  return output;\n}");
          } else if (line.indexOf("PS_OUTPUT main") >= 0) {
            lines[ndx] = `// ${line}\nPS_OUTPUT main(VS_OUTPUT input){`;
          } else if (line.indexOf("@@ MAIN PROLOGUE @@") >= 0) {
            lines[ndx] = `// ${line}\ngetInputs(input);`;
          }
        }

        ++ndx;
      }
    }

    const srcH2 = lines.join("\n");
    dsfNdx = shaderFiles.push(new DebugShaderFile(fnameH, srcH2, isVS, false, false));
    if (isVS)
      this._vertHNdx = dsfNdx - 1;
    else
      this._fragHNdx = dsfNdx - 1;
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

  public pushBranch(branch: Branch): void { this.target.pushBranch(branch); }
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

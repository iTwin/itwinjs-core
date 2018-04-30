/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, using, IDisposable } from "@bentley/bentleyjs-core";
import { ShaderProgram, ShaderProgramExecutor } from "./ShaderProgram";
import { TechniqueId } from "./TechniqueId";
import { TechniqueFlags } from "./TechniqueFlags";
import { ProgramBuilder, VertexShaderComponent, FragmentShaderComponent } from "./ShaderBuilder";
import { DrawParams } from "./DrawCommand";

// Defines a rendering technique implemented using one or more shader programs.
export interface Technique extends IDisposable {
  getShader(flags: TechniqueFlags): ShaderProgram;
}

// A rendering technique implemented using a single shader program, typically for some specialized purpose.
export class SingularTechnique implements Technique {
  public readonly program: ShaderProgram;

  public constructor(program: ShaderProgram) { this.program = program; }

  public getShader(_flags: TechniqueFlags) { return this.program; }

  public dispose(): void { this.program.dispose(); }
}

// A collection of rendering techniques accessed by ID.
export class Techniques implements IDisposable {
  private readonly _list = new Array<Technique>(); // indexed by TechniqueId, which may exceed TechniqueId.NumBuiltIn for dynamic techniques.
  private readonly _dynamicTechniqueIds = new Array<string>(); // technique ID = (index in this array) + TechniqueId.NumBuiltIn

  public static create(gl: WebGLRenderingContext) {
    const techs = new Techniques();
    return techs.initializeBuiltIns(gl) ? techs : undefined;
  }

  public getTechnique(id: TechniqueId): Technique {
    assert(id < this._list.length);
    return this._list[id];
  }

  public addDynamicTechnique(technique: Technique, name: string): TechniqueId {
    for (let i = 0; i < this._dynamicTechniqueIds.length; i++) {
      if (this._dynamicTechniqueIds[i] === name) {
        return TechniqueId.NumBuiltIn + i;
      }
    }

    this._dynamicTechniqueIds.push(name);
    this._list.push(technique);
    return TechniqueId.NumBuiltIn + this._dynamicTechniqueIds.length - 1;
  }

  // ###TODO: public draw(target: Target, commands: DrawCommands, pass: RenderPass): void { }
  public draw(params: DrawParams): void {
    const tech = this.getTechnique(params.geometry.getTechniqueId(params.target));
    const program = tech.getShader(TechniqueFlags.defaults);
    const executor = new ShaderProgramExecutor(params.target, params.renderPass, program);
    assert(executor.isValid);
    using(executor, () => {
      if (executor.isValid) {
        executor.draw(params);
      }
    });
  }

  public dispose(): void {
    for (const tech of this._list) {
      tech.dispose();
    }

    this._list.length = 0;
  }

  private constructor() { }

  private initializeBuiltIns(gl: WebGLRenderingContext): boolean {
    // ###TODO: For now, use a dummy placeholder for each unimplemented built-in technique...
    const builder = new ProgramBuilder(false);
    builder.vert.set(VertexShaderComponent.ComputePosition, "return vec4(0.0);");
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, "return vec4(1.0);");
    builder.frag.set(FragmentShaderComponent.AssignFragData, "FragColor = baseColor;");

    const prog = builder.buildProgram(gl);
    if (undefined === prog) {
      return false;
    }

    const tech = new SingularTechnique(prog);
    for (let i = 0; i < TechniqueId.NumBuiltIn; i++) {
      this._list.push(tech);
    }

    assert(this._list.length === TechniqueId.NumBuiltIn);
    return true;
  }
}

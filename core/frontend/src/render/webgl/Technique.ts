/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, using, IDisposable } from "@bentley/bentleyjs-core";
import { ShaderProgram, ShaderProgramExecutor } from "./ShaderProgram";
import { TechniqueId } from "./TechniqueId";
import { TechniqueFlags } from "./TechniqueFlags";
import { ProgramBuilder, VertexShaderComponent, FragmentShaderComponent } from "./ShaderBuilder";
import { DrawParams, DrawCommands } from "./DrawCommand";
import { Target } from "./Target";
import { RenderPass, CompositeFlags } from "./RenderFlags";
import { createClearTranslucentProgram } from "./glsl/ClearTranslucent";
import { createClearPickAndColorProgram } from "./glsl/ClearPickAndColor";
import { createCopyColorProgram } from "./glsl/CopyColor";
import { createCopyPickBuffersProgram } from "./glsl/CopyPickBuffers";
import { createCompositeProgram } from "./glsl/Composite";
import { createClipMaskProgram } from "./glsl/ClipMask";

// Defines a rendering technique implemented using one or more shader programs.
export interface Technique extends IDisposable {
  getShader(flags: TechniqueFlags): ShaderProgram;

  // Chiefly for tests - compiles all shader programs - more generally programs are compiled on demand.
  compileShaders(): boolean;
}

// A rendering technique implemented using a single shader program, typically for some specialized purpose.
export class SingularTechnique implements Technique {
  public readonly program: ShaderProgram;

  public constructor(program: ShaderProgram) { this.program = program; }

  public getShader(_flags: TechniqueFlags) { return this.program; }
  public compileShaders(): boolean { return this.program.compile(); }

  public dispose(): void { this.program.dispose(); }
}

// A rendering technique implemented using multiple shader programs, selected based on TechniqueFlags.
export abstract class VariedTechnique implements Technique {
  private readonly _programs: ShaderProgram[] = [];

  public getShader(flags: TechniqueFlags): ShaderProgram { return this._programs[this.getShaderIndex(flags)]; }
  public compileShaders(): boolean {
    let allCompiled = true;
    for (const program of this._programs) {
      if (!program.compile()) allCompiled = false;
    }

    return allCompiled;
  }

  public dispose(): void {
    for (const program of this._programs) {
      program.dispose();
    }
  }

  protected constructor(numPrograms: number) {
    this._programs.length = numPrograms;
  }

  protected abstract computeShaderIndex(flags: TechniqueFlags): number;

  protected addShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLRenderingContext): void { this.addProgram(flags, builder.buildProgram(gl)); }
  protected addProgram(flags: TechniqueFlags, program: ShaderProgram): void {
    const index = this.getShaderIndex(flags);
    assert(undefined === this._programs[index], "program already exists");
    this._programs[index] = program;
  }

  // ###TODO createHiliter() for convenience

  // ###TODO setFeatureSymbology - need FeatureOverrides

  // ###TODO addElementId

  // ###TODO addTranslucentShader() for convenience

  private getShaderIndex(flags: TechniqueFlags) {
    assert(!flags.isHilite || (!flags.isTranslucent && !flags.hasFeatures), "invalid technique flags");
    const index = this.computeShaderIndex(flags);
    assert(index < this._programs.length, "shader index out of bounds");
    return index;
  }
}

// A placeholder for techniques which have not yet been implemented.
class DummyTechnique extends VariedTechnique {
  public constructor(gl: WebGLRenderingContext) {
    super(2);

    const builder = new ProgramBuilder(false);
    builder.vert.set(VertexShaderComponent.ComputePosition, "return vec4(0.0);");
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, "return vec4(1.0);");
    builder.frag.set(FragmentShaderComponent.AssignFragData, "FragColor = baseColor;");

    const prog = builder.buildProgram(gl);
    const flags = new TechniqueFlags();
    this.addProgram(flags, prog);
    flags.isTranslucent = true;
    this.addProgram(flags, prog);
  }

  protected computeShaderIndex(flags: TechniqueFlags): number { return flags.isTranslucent ? 0 : 1; }
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
    assert(id < this._list.length, "technique index out of bounds");
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

  private readonly _scratchTechniqueFlags = new TechniqueFlags();

  /** Execute each command in the list */
  public execute(target: Target, commands: DrawCommands, renderPass: RenderPass) {
    assert(RenderPass.None !== renderPass, "invalid render pass");

    const flags = this._scratchTechniqueFlags;
    using(new ShaderProgramExecutor(target, renderPass), (executor: ShaderProgramExecutor) => {
      for (const command of commands) {
        command.preExecute(executor);

        const techniqueId = command.getTechniqueId(target);
        if (TechniqueId.Invalid !== techniqueId) {
          // A primitive command.
          assert(command.isPrimitiveCommand, "expected primitive command");
          flags.init(target, renderPass);
          const tech = this.getTechnique(techniqueId);
          const program = tech.getShader(flags);
          if (executor.setProgram(program)) {
            command.execute(executor);
          }
        } else {
          // A branch command.
          assert(!command.isPrimitiveCommand, "expected non-primitive command");
          command.execute(executor);
        }

        command.postExecute(executor);
      }
    });
  }

  /** Draw a single primitive. Usually used for special-purpose rendering techniques. */
  public draw(params: DrawParams): void {
    const tech = this.getTechnique(params.geometry.getTechniqueId(params.target));
    const program = tech.getShader(TechniqueFlags.defaults);
    using(new ShaderProgramExecutor(params.target, params.renderPass, program), (executor: ShaderProgramExecutor) => {
      assert(executor.isValid);
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

  // Chiefly for tests - compiles all shader programs - more generally programs are compiled on demand.
  public compileShaders(): boolean {
    let allCompiled = true;

    for (const tech of this._list) {
      if (!tech.compileShaders()) {
        allCompiled = false;
      }
    }

    return allCompiled;
  }

  private constructor() { }

  private initializeBuiltIns(gl: WebGLRenderingContext): boolean {
    // ###TODO: For now, use a dummy placeholder for each unimplemented built-in technique...
    const tech = new DummyTechnique(gl);
    for (let i = 0; i < TechniqueId.NumBuiltIn; i++) {
      this._list.push(tech);
    }

    // Replace dummy techniques with the real techniques implemented thus far...
    this._list[TechniqueId.OITClearTranslucent] = new SingularTechnique(createClearTranslucentProgram(gl));
    this._list[TechniqueId.ClearPickAndColor] = new SingularTechnique(createClearPickAndColorProgram(gl));
    this._list[TechniqueId.CopyColor] = new SingularTechnique(createCopyColorProgram(gl));
    this._list[TechniqueId.CopyPickBuffers] = new SingularTechnique(createCopyPickBuffersProgram(gl));
    this._list[TechniqueId.CompositeHilite] = new SingularTechnique(createCompositeProgram(CompositeFlags.Hilite, gl));
    this._list[TechniqueId.CompositeTranslucent] = new SingularTechnique(createCompositeProgram(CompositeFlags.Translucent, gl));
    this._list[TechniqueId.CompositeHiliteAndTranslucent] = new SingularTechnique(createCompositeProgram(CompositeFlags.Hilite | CompositeFlags.Translucent, gl));
    this._list[TechniqueId.ClipMask] = new SingularTechnique(createClipMaskProgram(gl));

    assert(this._list.length === TechniqueId.NumBuiltIn, "unexpected number of built-in techniques");
    return true;
  }
}

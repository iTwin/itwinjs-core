/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, using, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { ShaderProgram, ShaderProgramExecutor } from "./ShaderProgram";
import { TechniqueId } from "./TechniqueId";
import { TechniqueFlags, FeatureMode, ClipDef } from "./TechniqueFlags";
import { ProgramBuilder, VertexShaderComponent, FragmentShaderComponent, ClippingShaders } from "./ShaderBuilder";
import { DrawParams, DrawCommands } from "./DrawCommand";
import { Target } from "./Target";
import { RenderPass, CompositeFlags } from "./RenderFlags";
import { createClearTranslucentProgram } from "./glsl/ClearTranslucent";
import { createClearPickAndColorProgram } from "./glsl/ClearPickAndColor";
import { createCopyColorProgram } from "./glsl/CopyColor";
import { createCopyPickBuffersProgram } from "./glsl/CopyPickBuffers";
import { createCopyStencilProgram } from "./glsl/CopyStencil";
import { createCompositeProgram } from "./glsl/Composite";
import { createClipMaskProgram } from "./glsl/ClipMask";
import { addTranslucency } from "./glsl/Translucency";
import { addMonochrome } from "./glsl/Monochrome";
import { createSurfaceBuilder, createSurfaceHiliter, addMaterial, addSurfaceDiscardByAlpha } from "./glsl/Surface";
import { createPointStringBuilder, createPointStringHiliter } from "./glsl/PointString";
import { createPointCloudBuilder, createPointCloudHiliter } from "./glsl/PointCloud";
import { addElementId, addFeatureSymbology, addRenderOrder, computeElementId, computeUniformElementId, FeatureSymbologyOptions } from "./glsl/FeatureSymbology";
import { GLSLFragment, addPickBufferOutputs } from "./glsl/Fragment";
import { addFrustum, addEyeSpace } from "./glsl/Common";
import { addModelViewMatrix } from "./glsl/Vertex";
import { createPolylineBuilder, createPolylineHiliter } from "./glsl/Polyline";
import { createEdgeBuilder } from "./glsl/Edge";
import { createSkyBoxProgram } from "./glsl/SkyBox";
import { createSkySphereProgram } from "./glsl/SkySphere";

// Defines a rendering technique implemented using one or more shader programs.
export interface Technique extends IDisposable {
  getShader(flags: TechniqueFlags): ShaderProgram;

  // Chiefly for tests - compiles all shader programs - more generally programs are compiled on demand.
  compileShaders(): boolean;
}

// A rendering technique implemented using a single shader program, typically for some specialized purpose.
export class SingularTechnique implements Technique {
  public readonly program: ShaderProgram;

  // Note: Technique assumes ownership of a program
  public constructor(program: ShaderProgram) { this.program = program; }

  public getShader(_flags: TechniqueFlags) { return this.program; }
  public compileShaders(): boolean { return this.program.compile(); }

  public dispose(): void {
    dispose(this.program);
  }
}

function numFeatureVariants(numBaseShaders: number) { return numBaseShaders * 3; }
const numHiliteVariants = 1;
const featureModes = [FeatureMode.None, FeatureMode.Pick, FeatureMode.Overrides];
const scratchTechniqueFlags = new TechniqueFlags();

// A rendering technique implemented using multiple shader programs, selected based on TechniqueFlags.
export abstract class VariedTechnique implements Technique {
  private readonly _basicPrograms: ShaderProgram[] = [];
  private readonly _clippingPrograms: ClippingShaders[] = [];

  public compileShaders(): boolean {
    let allCompiled = true;
    for (const program of this._basicPrograms) {
      if (!program.compile()) allCompiled = false;
    }

    return allCompiled;
  }

  public dispose(): void {
    for (const program of this._basicPrograms)
      dispose(program);
    this._basicPrograms.length = 0;
    for (const clipShaderObj of this._clippingPrograms) {
      dispose(clipShaderObj.maskShader);
      for (const clipShader of clipShaderObj.shaders)
        dispose(clipShader);
      clipShaderObj.shaders.length = 0;
      clipShaderObj.maskShader = undefined;
    }
  }

  protected constructor(numPrograms: number) {
    this._basicPrograms.length = numPrograms;
  }

  protected abstract computeShaderIndex(flags: TechniqueFlags): number;
  protected abstract get _debugDescription(): string;

  protected addShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLRenderingContext): void {
    const descr = this._debugDescription + ": " + flags.buildDescription();
    builder.setDebugDescription(descr);

    const index = this.getShaderIndex(flags);
    assert(this._basicPrograms[index] === undefined);
    this._basicPrograms[index] = builder.buildProgram(gl);
    assert(this._basicPrograms[index] !== undefined);

    assert(this._clippingPrograms[index] === undefined);
    this._clippingPrograms[index] = new ClippingShaders(builder, gl);
    assert(this._clippingPrograms[index] !== undefined);
  }

  protected addProgram(flags: TechniqueFlags, program: ShaderProgram): void {
    const index = this.getShaderIndex(flags);
    assert(undefined === this._basicPrograms[index], "program already exists");
    this._basicPrograms[index] = program;
  }

  protected addHiliteShader(gl: WebGLRenderingContext, create: () => ProgramBuilder): void {
    const builder = create();
    scratchTechniqueFlags.initForHilite(new ClipDef());
    this.addShader(builder, scratchTechniqueFlags, gl);
  }

  protected addTranslucentShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLRenderingContext): void {
    flags.isTranslucent = true;
    addTranslucency(builder);
    this.addShader(builder, flags, gl);
  }

  protected addElementId(builder: ProgramBuilder, feat: FeatureMode, alwaysUniform: boolean = false) {
    const frag = builder.frag;
    if (FeatureMode.None === feat)
      frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
    else {
      const vert = builder.vert;
      vert.set(VertexShaderComponent.AddComputeElementId, alwaysUniform ? computeUniformElementId : computeElementId);
      addFrustum(builder);
      addEyeSpace(builder);
      addModelViewMatrix(vert);
      addRenderOrder(frag);
      addElementId(builder, alwaysUniform);
      addPickBufferOutputs(frag);
    }
  }

  private getShaderIndex(flags: TechniqueFlags) {
    assert(!flags.isHilite || (!flags.isTranslucent && flags.hasFeatures), "invalid technique flags");
    const index = this.computeShaderIndex(flags);
    assert(index < this._basicPrograms.length, "shader index out of bounds");
    return index;
  }

  public getShader(flags: TechniqueFlags): ShaderProgram {
    const index = this.getShaderIndex(flags);
    let program: ShaderProgram | undefined;

    if (flags.hasClip) {
      const entry = this._clippingPrograms[index];
      assert(undefined !== entry);
      program = entry.getProgram(flags.clip);
    }

    if (program === undefined)
      program = this._basicPrograms[index];

    return program;
  }
}

class SurfaceTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kAnimated = 2;
  private static readonly _kFeature = 4;
  private static readonly _kHilite = numFeatureVariants(SurfaceTechnique._kFeature);

  public constructor(gl: WebGLRenderingContext) {
    super((numFeatureVariants(4) + numHiliteVariants));

    const flags = scratchTechniqueFlags;
    this.addHiliteShader(gl, createSurfaceHiliter);
    for (let iAnimate = 0; iAnimate < 2; iAnimate++) {
      for (const featureMode of featureModes) {
        flags.reset(featureMode);
        flags.isAnimated = iAnimate !== 0;
        const builder = createSurfaceBuilder(featureMode, flags.isAnimated);
        addMonochrome(builder.frag);
        addMaterial(builder.frag);

        addSurfaceDiscardByAlpha(builder.frag);
        this.addShader(builder, flags, gl);

        builder.frag.unset(FragmentShaderComponent.DiscardByAlpha);
        this.addTranslucentShader(builder, flags, gl);
      }
    }
  }
  protected get _debugDescription() { return "Surface"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite) {
      assert(flags.hasFeatures);
      return SurfaceTechnique._kHilite;
    }

    let index = flags.isTranslucent ? SurfaceTechnique._kTranslucent : SurfaceTechnique._kOpaque;
    index += SurfaceTechnique._kFeature * flags.featureMode;
    if (flags.isAnimated)
      index += SurfaceTechnique._kAnimated;

    return index;
  }
}

class PolylineTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kFeature = 2;
  private static readonly _kHilite = numFeatureVariants(PolylineTechnique._kFeature);

  public constructor(gl: WebGLRenderingContext) {
    super((numFeatureVariants(2) + numHiliteVariants));

    const flags = scratchTechniqueFlags;
    this.addHiliteShader(gl, createPolylineHiliter);
    for (const featureMode of featureModes) {
      flags.reset(featureMode);
      const builder = createPolylineBuilder();
      addMonochrome(builder.frag);

      // The translucent shaders do not need the element IDs.
      const builderTrans = createPolylineBuilder();
      addMonochrome(builderTrans.frag);
      if (FeatureMode.Overrides === featureMode) {
        addFeatureSymbology(builderTrans, featureMode, FeatureSymbologyOptions.Linear);
        addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.Linear);
        this.addTranslucentShader(builderTrans, flags, gl);
      } else {
        this.addTranslucentShader(builderTrans, flags, gl);
        addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.None);
      }
      this.addElementId(builder, featureMode);
      flags.reset(featureMode);
      this.addShader(builder, flags, gl);
    }
  }

  protected get _debugDescription() { return "Polyline"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite) {
      assert(flags.hasFeatures);
      return PolylineTechnique._kHilite;
    }

    let index = flags.isTranslucent ? PolylineTechnique._kTranslucent : PolylineTechnique._kOpaque;
    index += PolylineTechnique._kFeature * flags.featureMode;
    return index;
  }
}

class EdgeTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kAnimated = 2;
  private static readonly _kFeature = 4;
  private readonly _isSilhouette: boolean;

  public constructor(gl: WebGLRenderingContext, isSilhouette: boolean = false) {
    super(numFeatureVariants(4));
    this._isSilhouette = isSilhouette;

    const flags = scratchTechniqueFlags;
    for (let iAnimate = 0; iAnimate < 2; iAnimate++) {
      for (const featureMode of featureModes) {
        flags.reset(featureMode);
        flags.isAnimated = iAnimate !== 0;
        const builder = createEdgeBuilder(isSilhouette, flags.isAnimated);
        addMonochrome(builder.frag);

        // The translucent shaders do not need the element IDs.
        const builderTrans = createEdgeBuilder(isSilhouette, flags.isAnimated);
        addMonochrome(builderTrans.frag);
        if (FeatureMode.Overrides === featureMode) {
          addFeatureSymbology(builderTrans, featureMode, FeatureSymbologyOptions.Linear);
          addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.Linear);
          this.addTranslucentShader(builderTrans, flags, gl);
        } else {
          this.addTranslucentShader(builderTrans, flags, gl);
          addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.None);
        }
        this.addElementId(builder, featureMode);
        flags.reset(featureMode);
        this.addShader(builder, flags, gl);
      }
    }
  }

  protected get _debugDescription() { return this._isSilhouette ? "Silhouette" : "Edge"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    let index = flags.isTranslucent ? EdgeTechnique._kTranslucent : EdgeTechnique._kOpaque;
    index += EdgeTechnique._kFeature * flags.featureMode;
    if (flags.isAnimated)
      index += EdgeTechnique._kAnimated;

    return index;
  }
}

class PointStringTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kFeature = 2;
  private static readonly _kHilite = numFeatureVariants(PointStringTechnique._kFeature);

  public constructor(gl: WebGLRenderingContext) {
    super((numFeatureVariants(2) + numHiliteVariants));

    const flags = scratchTechniqueFlags;
    this.addHiliteShader(gl, createPointStringHiliter);
    for (const featureMode of featureModes) {
      flags.reset(featureMode);
      const builder = createPointStringBuilder();
      addMonochrome(builder.frag);

      // The translucent shaders do not need the element IDs.
      const builderTrans = createPointStringBuilder();
      addMonochrome(builderTrans.frag);
      if (FeatureMode.Overrides === featureMode) {
        addFeatureSymbology(builderTrans, featureMode, FeatureSymbologyOptions.Point);
        addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.Point);
        this.addTranslucentShader(builderTrans, flags, gl);
      } else {
        this.addTranslucentShader(builderTrans, flags, gl);
        addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.None);
      }
      this.addElementId(builder, featureMode);
      flags.reset(featureMode);
      this.addShader(builder, flags, gl);
    }
  }

  protected get _debugDescription() { return "PointString"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite) {
      assert(flags.hasFeatures);
      return PointStringTechnique._kHilite;
    }

    let index = flags.isTranslucent ? PointStringTechnique._kTranslucent : PointStringTechnique._kOpaque;
    index += PointStringTechnique._kFeature * flags.featureMode;
    return index;
  }
}

class PointCloudTechnique extends VariedTechnique {
  private static readonly _kHilite = numFeatureVariants(1);

  public constructor(gl: WebGLRenderingContext) {
    super(numFeatureVariants(1) + numHiliteVariants);

    const flags = scratchTechniqueFlags;
    this.addHiliteShader(gl, createPointCloudHiliter);
    for (const feature of featureModes) {
      flags.reset(feature);
      const builder = createPointCloudBuilder();
      const opts = FeatureMode.Overrides === feature ? FeatureSymbologyOptions.PointCloud : FeatureSymbologyOptions.None;
      addFeatureSymbology(builder, feature, opts, true);
      this.addElementId(builder, feature, true);
      this.addShader(builder, flags, gl);
    }
  }

  protected get _debugDescription() { return "PointCloud"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    let index: number;
    if (flags.isHilite)
      index = PointCloudTechnique._kHilite;
    else
      index = flags.featureMode;

    return index;
  }
}

// A collection of rendering techniques accessed by ID.
export class Techniques implements IDisposable {
  private readonly _list = new Array<Technique>(); // indexed by TechniqueId, which may exceed TechniqueId.NumBuiltIn for dynamic techniques.
  private readonly _dynamicTechniqueIds = new Array<string>(); // technique ID = (index in this array) + TechniqueId.NumBuiltIn

  public static create(gl: WebGLRenderingContext): Techniques {
    const techs = new Techniques();
    techs.initializeBuiltIns(gl);
    return techs;
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
          flags.init(target, renderPass, command.hasAnimation);
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

  /** Execute the commands for a single given classification primitive */
  public executeForIndexedClassifier(target: Target, commands: DrawCommands, renderPass: RenderPass, index: number, techId?: TechniqueId) {
    assert(RenderPass.None !== renderPass, "invalid render pass");

    const flags = this._scratchTechniqueFlags;
    using(new ShaderProgramExecutor(target, renderPass), (executor: ShaderProgramExecutor) => {

      // First execute the batch push.
      commands[0].preExecute(executor);
      let techniqueId = commands[0].getTechniqueId(target);
      assert(TechniqueId.Invalid === techniqueId);
      assert(!commands[0].isPrimitiveCommand, "expected non-primitive command");
      commands[0].execute(executor);
      commands[0].postExecute(executor);

      // Execute the command for the given classification primitive.
      const command = commands[index + 1];
      command.preExecute(executor);
      techniqueId = command.getTechniqueId(target);
      assert(TechniqueId.Invalid !== techniqueId);
      // A primitive command.
      assert(command.isPrimitiveCommand, "expected primitive command");
      flags.init(target, renderPass, command.hasAnimation);
      const tech = this.getTechnique(undefined !== techId ? techId : techniqueId);
      const program = tech.getShader(flags);
      if (executor.setProgram(program)) {
        command.execute(executor);
      }
      command.postExecute(executor);

      // Execute the batch pop.
      const last = commands.length - 1;
      commands[last].preExecute(executor);
      techniqueId = commands[last].getTechniqueId(target);
      assert(TechniqueId.Invalid === techniqueId);
      assert(!commands[last].isPrimitiveCommand, "expected non-primitive command");
      commands[last].execute(executor);
      commands[last].postExecute(executor);
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
    for (const tech of this._list)
      dispose(tech);
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

  private initializeBuiltIns(gl: WebGLRenderingContext): void {
    this._list[TechniqueId.OITClearTranslucent] = new SingularTechnique(createClearTranslucentProgram(gl));
    this._list[TechniqueId.ClearPickAndColor] = new SingularTechnique(createClearPickAndColorProgram(gl));
    this._list[TechniqueId.CopyColor] = new SingularTechnique(createCopyColorProgram(gl));
    this._list[TechniqueId.CopyColorNoAlpha] = new SingularTechnique(createCopyColorProgram(gl, false));
    this._list[TechniqueId.CopyPickBuffers] = new SingularTechnique(createCopyPickBuffersProgram(gl));
    this._list[TechniqueId.CopyStencil] = new SingularTechnique(createCopyStencilProgram(gl));
    this._list[TechniqueId.CompositeHilite] = new SingularTechnique(createCompositeProgram(CompositeFlags.Hilite, gl));
    this._list[TechniqueId.CompositeTranslucent] = new SingularTechnique(createCompositeProgram(CompositeFlags.Translucent, gl));
    this._list[TechniqueId.CompositeHiliteAndTranslucent] = new SingularTechnique(createCompositeProgram(CompositeFlags.Hilite | CompositeFlags.Translucent, gl));
    this._list[TechniqueId.ClipMask] = new SingularTechnique(createClipMaskProgram(gl));
    this._list[TechniqueId.SkyBox] = new SingularTechnique(createSkyBoxProgram(gl));
    this._list[TechniqueId.SkySphereGradient] = new SingularTechnique(createSkySphereProgram(gl, true));
    this._list[TechniqueId.SkySphereTexture] = new SingularTechnique(createSkySphereProgram(gl, false));
    this._list[TechniqueId.Surface] = new SurfaceTechnique(gl);
    this._list[TechniqueId.Edge] = new EdgeTechnique(gl, false);
    this._list[TechniqueId.SilhouetteEdge] = new EdgeTechnique(gl, true);
    this._list[TechniqueId.Polyline] = new PolylineTechnique(gl);
    this._list[TechniqueId.PointString] = new PointStringTechnique(gl);
    this._list[TechniqueId.PointCloud] = new PointCloudTechnique(gl);

    assert(this._list.length === TechniqueId.NumBuiltIn, "unexpected number of built-in techniques");
  }
}

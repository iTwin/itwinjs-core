/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, using, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { ShaderProgram, ShaderProgramExecutor } from "./ShaderProgram";
import { TechniqueId } from "./TechniqueId";
import { TechniqueFlags, FeatureMode, ClipDef } from "./TechniqueFlags";
import { ProgramBuilder, VertexShaderComponent, FragmentShaderComponent, VariableType, ClippingShaders } from "./ShaderBuilder";
import { DrawParams, DrawCommands } from "./DrawCommand";
import { Target } from "./Target";
import { RenderPass, CompositeFlags } from "./RenderFlags";
import { createClearTranslucentProgram } from "./glsl/ClearTranslucent";
import { createClearPickAndColorProgram } from "./glsl/ClearPickAndColor";
import { createCopyColorProgram } from "./glsl/CopyColor";
import { createCopyPickBuffersProgram } from "./glsl/CopyPickBuffers";
import { createCompositeProgram } from "./glsl/Composite";
import { createClipMaskProgram } from "./glsl/ClipMask";
import { addTranslucency } from "./glsl/Translucency";
import { addMonochrome } from "./glsl/Monochrome";
import { createSurfaceBuilder, createSurfaceHiliter, addMaterial } from "./glsl/Surface";
import { createPointStringBuilder, createPointStringHiliter } from "./glsl/PointString";
import { createPointCloudBuilder, createPointCloudHiliter } from "./glsl/PointCloud";
import { addElementId, addFeatureSymbology, addRenderOrder, computeElementId, computeUniformElementId, computeEyeSpace, FeatureSymbologyOptions } from "./glsl/FeatureSymbology";
import { GLSLFragment, addPickBufferOutputs } from "./glsl/Fragment";
import { addFrustum } from "./glsl/Common";
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
  protected abstract get debugDescription(): string;

  protected addShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLRenderingContext): void {
    const descr = this.debugDescription + ": " + flags.buildDescription();
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
      builder.addInlineComputedVarying("v_eyeSpace", VariableType.Vec3, computeEyeSpace);
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
  private static readonly kOpaque = 0;
  private static readonly kTranslucent = 1;
  private static readonly kFeature = 2;
  private static readonly kHilite = numFeatureVariants(SurfaceTechnique.kFeature);
  // private static readonly kClip = SurfaceTechnique.kHilite + 1;

  public constructor(gl: WebGLRenderingContext) {
    super((numFeatureVariants(2) + numHiliteVariants));

    const flags = scratchTechniqueFlags;
    this.addHiliteShader(gl, createSurfaceHiliter);
    for (const featureMode of featureModes) {
      flags.reset(featureMode);
      const builder = createSurfaceBuilder(featureMode);
      addMonochrome(builder.frag);
      addMaterial(builder.frag);

      this.addShader(builder, flags, gl);
      this.addTranslucentShader(builder, flags, gl);
    }
  }

  protected get debugDescription() { return "Surface"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite) {
      assert(flags.hasFeatures);
      return SurfaceTechnique.kHilite;
    }

    let index = flags.isTranslucent ? SurfaceTechnique.kTranslucent : SurfaceTechnique.kOpaque;
    index += SurfaceTechnique.kFeature * flags.featureMode;
    return index;
  }
}

class PolylineTechnique extends VariedTechnique {
  private static readonly kOpaque = 0;
  private static readonly kTranslucent = 1;
  private static readonly kFeature = 2;
  private static readonly kHilite = numFeatureVariants(PolylineTechnique.kFeature);
  // private static readonly kClip = PolylineTechnique.kHilite + 1;

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

  protected get debugDescription() { return "Polyline"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite) {
      assert(flags.hasFeatures);
      return PolylineTechnique.kHilite;
    }

    let index = flags.isTranslucent ? PolylineTechnique.kTranslucent : PolylineTechnique.kOpaque;
    index += PolylineTechnique.kFeature * flags.featureMode;
    return index;
  }
}

class EdgeTechnique extends VariedTechnique {
  private static readonly kOpaque = 0;
  private static readonly kTranslucent = 1;
  private static readonly kFeature = 2;
  // private static readonly kClip = numFeatureVariants(EdgeTechnique.kFeature);
  private readonly _isSilhouette: boolean;

  public constructor(gl: WebGLRenderingContext, isSilhouette: boolean = false) {
    super(numFeatureVariants(2));
    this._isSilhouette = isSilhouette;

    const flags = scratchTechniqueFlags;
    for (const featureMode of featureModes) {
      flags.reset(featureMode);
      const builder = createEdgeBuilder(isSilhouette);
      addMonochrome(builder.frag);

      // The translucent shaders do not need the element IDs.
      const builderTrans = createEdgeBuilder(isSilhouette);
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

  protected get debugDescription() { return this._isSilhouette ? "Silhouette" : "Edge"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    let index = flags.isTranslucent ? EdgeTechnique.kTranslucent : EdgeTechnique.kOpaque;
    index += EdgeTechnique.kFeature * flags.featureMode;
    return index;
  }
}

class PointStringTechnique extends VariedTechnique {
  private static readonly kOpaque = 0;
  private static readonly kTranslucent = 1;
  private static readonly kFeature = 2;
  private static readonly kHilite = numFeatureVariants(PointStringTechnique.kFeature);
  // private static readonly kClip = PointStringTechnique.kHilite + 1;

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

  protected get debugDescription() { return "PointString"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite) {
      assert(flags.hasFeatures);
      return PointStringTechnique.kHilite;
    }

    let index = flags.isTranslucent ? PointStringTechnique.kTranslucent : PointStringTechnique.kOpaque;
    index += PointStringTechnique.kFeature * flags.featureMode;
    return index;
  }
}

class PointCloudTechnique extends VariedTechnique {
  private static readonly kHilite = numFeatureVariants(1);

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

  protected get debugDescription() { return "PointCloud"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    let index: number;
    if (flags.isHilite)
      index = PointCloudTechnique.kHilite;
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

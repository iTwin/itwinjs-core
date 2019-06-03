/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, using, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { ShaderProgram, ShaderProgramExecutor } from "./ShaderProgram";
import { TechniqueId, computeCompositeTechniqueId } from "./TechniqueId";
import { IsInstanced, IsAnimated, IsClassified, IsShadowable, TechniqueFlags, FeatureMode, ClipDef, IsEdgeTestNeeded } from "./TechniqueFlags";
import { ProgramBuilder, FragmentShaderComponent, ClippingShaders } from "./ShaderBuilder";
import { DrawParams, DrawCommands, OmitStatus } from "./DrawCommand";
import { Target } from "./Target";
import { RenderPass } from "./RenderFlags";
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
import { addFeatureId, addFeatureSymbology, addUniformFeatureSymbology, addRenderOrder, FeatureSymbologyOptions } from "./glsl/FeatureSymbology";
import { GLSLFragment, addPickBufferOutputs } from "./glsl/Fragment";
import { addFrustum, addEyeSpace } from "./glsl/Common";
import { addModelViewMatrix } from "./glsl/Vertex";
import { createPolylineBuilder, createPolylineHiliter } from "./glsl/Polyline";
import { createEdgeBuilder } from "./glsl/Edge";
import { createSkyBoxProgram } from "./glsl/SkyBox";
import { createSkySphereProgram } from "./glsl/SkySphere";
import { createAmbientOcclusionProgram } from "./glsl/AmbientOcclusion";
import { createBlurProgram } from "./glsl/Blur";
import { createCombineTexturesProgram } from "./glsl/CombineTextures";

/** Defines a rendering technique implemented using one or more shader programs.
 * @internal
 */
export interface Technique extends IDisposable {
  getShader(flags: TechniqueFlags): ShaderProgram;

  // Chiefly for tests - compiles all shader programs - more generally programs are compiled on demand.
  compileShaders(): boolean;
}

/** A rendering technique implemented using a single shader program, typically for some specialized purpose.
 * @internal
 */
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
const numHiliteVariants = 2; // instanced and non-instanced.
const featureModes = [FeatureMode.None, FeatureMode.Pick, FeatureMode.Overrides];
const scratchTechniqueFlags = new TechniqueFlags();
const scratchHiliteFlags = new TechniqueFlags();

/** A rendering technique implemented using multiple shader programs, selected based on TechniqueFlags.
 * @internal
 */
export abstract class VariedTechnique implements Technique {
  private readonly _basicPrograms: ShaderProgram[] = [];
  private readonly _clippingPrograms: ClippingShaders[] = [];

  public compileShaders(): boolean {
    let allCompiled = true;
    for (const program of this._basicPrograms) {
      if (!program.compile()) allCompiled = false;
    }

    for (const clipProg of this._clippingPrograms) {
      if (!clipProg.compileShaders()) allCompiled = false;
    }

    return allCompiled;
  }

  protected verifyShadersContiguous(): void {
    let emptyShaderIndex = -1;
    assert(-1 === (emptyShaderIndex = this._basicPrograms.findIndex((prog) => undefined === prog)), "Shader index " + emptyShaderIndex + " is undefined in " + this.constructor.name);
  }

  public dispose(): void {
    for (const program of this._basicPrograms) {
      assert(undefined !== program);
      dispose(program);
    }

    this._basicPrograms.length = 0;
    for (const clipShaderObj of this._clippingPrograms) {
      assert(undefined !== clipShaderObj);
      assert(undefined !== clipShaderObj.maskShader);
      dispose(clipShaderObj.maskShader);

      for (const clipShader of clipShaderObj.shaders) {
        assert(undefined !== clipShader);
        dispose(clipShader);
      }

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

  protected addHiliteShader(gl: WebGLRenderingContext, instanced: IsInstanced, classified: IsClassified, create: (instanced: IsInstanced, classified: IsClassified) => ProgramBuilder): void {
    const builder = create(instanced, classified);
    scratchHiliteFlags.initForHilite(new ClipDef(), instanced, classified);
    this.addShader(builder, scratchHiliteFlags, gl);
  }

  protected addTranslucentShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLRenderingContext): void {
    flags.isTranslucent = true;
    addTranslucency(builder);
    this.addShader(builder, flags, gl);
  }

  protected addFeatureId(builder: ProgramBuilder, feat: FeatureMode) {
    const frag = builder.frag;
    if (FeatureMode.None === feat)
      frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
    else {
      const vert = builder.vert;
      addFrustum(builder);
      addEyeSpace(builder);
      addModelViewMatrix(vert);
      addRenderOrder(frag);
      addFeatureId(builder);
      addPickBufferOutputs(frag);
    }
  }

  private getShaderIndex(flags: TechniqueFlags) {
    assert(!flags.isHilite || (!flags.isTranslucent && (flags.isClassified === IsClassified.Yes || flags.hasFeatures)), "invalid technique flags");
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

/** @internal */
const enum HasAnimationOrShadows { Neither, Animation, Shadows }

class SurfaceTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kInstanced = 2;
  private static readonly _kFeature = 4;
  private static readonly _kEdgeTestNeeded = 8; // only when hasFeatures
  private static readonly _kAnimated = numFeatureVariants(SurfaceTechnique._kFeature) + SurfaceTechnique._kEdgeTestNeeded;
  private static readonly _kShadowable = SurfaceTechnique._kAnimated + numFeatureVariants(SurfaceTechnique._kFeature) + SurfaceTechnique._kEdgeTestNeeded;
  private static readonly _kHilite = SurfaceTechnique._kShadowable + numFeatureVariants(SurfaceTechnique._kFeature) + SurfaceTechnique._kEdgeTestNeeded;
  // Classifiers are a special case - they are never translucent, animated, or instanced. We have 4 variants: 1 for each of the 3 feature modes, plus 1 for hilite.
  private static readonly _kClassified = SurfaceTechnique._kHilite + numHiliteVariants;

  public constructor(gl: WebGLRenderingContext) {
    super(SurfaceTechnique._kClassified + numFeatureVariants(1) + 1);
    const flags = scratchTechniqueFlags;

    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createSurfaceHiliter);
      for (let hasAnimOrShadow = HasAnimationOrShadows.Neither; hasAnimOrShadow <= HasAnimationOrShadows.Shadows; hasAnimOrShadow++) {
        const iAnimate = HasAnimationOrShadows.Animation === hasAnimOrShadow ? IsAnimated.Yes : IsAnimated.No;
        const shadowable = HasAnimationOrShadows.Shadows === hasAnimOrShadow ? IsShadowable.Yes : IsShadowable.No;
        for (let edgeTestNeeded = IsEdgeTestNeeded.No; edgeTestNeeded <= IsEdgeTestNeeded.Yes; edgeTestNeeded++) {
          for (const featureMode of featureModes) {
            if (FeatureMode.None !== featureMode || IsEdgeTestNeeded.No === edgeTestNeeded) {
              flags.reset(featureMode, instanced, shadowable);
              flags.isAnimated = iAnimate;
              flags.isEdgeTestNeeded = edgeTestNeeded;
              const builder = createSurfaceBuilder(featureMode, flags.isInstanced, flags.isAnimated, IsClassified.No, flags.isShadowable, flags.isEdgeTestNeeded);
              addMonochrome(builder.frag);
              addMaterial(builder.frag);

              addSurfaceDiscardByAlpha(builder.frag);
              this.addShader(builder, flags, gl);

              builder.frag.unset(FragmentShaderComponent.DiscardByAlpha);
              this.addTranslucentShader(builder, flags, gl);
            }
          }
        }
      }
    }

    this.addHiliteShader(gl, IsInstanced.No, IsClassified.Yes, createSurfaceHiliter);
    for (const featureMode of featureModes) {
      flags.reset(featureMode, IsInstanced.No, IsShadowable.No);
      flags.isClassified = IsClassified.Yes;

      const builder = createSurfaceBuilder(featureMode, IsInstanced.No, IsAnimated.No, IsClassified.Yes, IsShadowable.No, flags.isEdgeTestNeeded);
      addMonochrome(builder.frag);
      addMaterial(builder.frag);
      addSurfaceDiscardByAlpha(builder.frag);

      this.addShader(builder, flags, gl);
    }

    this.verifyShadersContiguous();
  }

  protected get _debugDescription() { return "Surface"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isClassified) {
      assert(!flags.isAnimated);
      assert(!flags.isTranslucent);
      assert(!flags.isInstanced);
      assert(!flags.isShadowable);
      assert(!flags.isEdgeTestNeeded);

      const baseIndex = SurfaceTechnique._kClassified;
      return flags.isHilite ? baseIndex + numFeatureVariants(1) : baseIndex + flags.featureMode;
    } else if (flags.isHilite) {
      assert(flags.hasFeatures);
      return SurfaceTechnique._kHilite + flags.isInstanced;
    }

    assert(flags.hasFeatures || flags.isEdgeTestNeeded === IsEdgeTestNeeded.No);
    let index = flags.isTranslucent ? SurfaceTechnique._kTranslucent : SurfaceTechnique._kOpaque;
    if (flags.isInstanced)
      index += SurfaceTechnique._kInstanced;
    index += SurfaceTechnique._kFeature * flags.featureMode;
    if (flags.isEdgeTestNeeded)
      index += SurfaceTechnique._kEdgeTestNeeded;
    if (flags.isAnimated)
      index += SurfaceTechnique._kAnimated;
    if (flags.isShadowable)
      index += SurfaceTechnique._kShadowable;

    return index;
  }
}

class PolylineTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kInstanced = 2;
  private static readonly _kFeature = 4;
  private static readonly _kHilite = numFeatureVariants(PolylineTechnique._kFeature);

  public constructor(gl: WebGLRenderingContext) {
    super(PolylineTechnique._kHilite + numHiliteVariants);

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createPolylineHiliter);
      for (const featureMode of featureModes) {
        flags.reset(featureMode, instanced, IsShadowable.No);
        const builder = createPolylineBuilder(instanced);
        addMonochrome(builder.frag);

        // The translucent shaders do not need the element IDs.
        const builderTrans = createPolylineBuilder(instanced);
        addMonochrome(builderTrans.frag);
        if (FeatureMode.Overrides === featureMode) {
          addFeatureSymbology(builderTrans, featureMode, FeatureSymbologyOptions.Linear);
          addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.Linear);
          this.addTranslucentShader(builderTrans, flags, gl);
        } else {
          this.addTranslucentShader(builderTrans, flags, gl);
          addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.None);
        }

        this.addFeatureId(builder, featureMode);
        flags.reset(featureMode, instanced, IsShadowable.No);
        this.addShader(builder, flags, gl);
      }
    }
    this.verifyShadersContiguous();
  }

  protected get _debugDescription() { return "Polyline"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite) {
      assert(flags.hasFeatures);
      return PolylineTechnique._kHilite + flags.isInstanced;
    }

    let index = flags.isTranslucent ? PolylineTechnique._kTranslucent : PolylineTechnique._kOpaque;
    index += PolylineTechnique._kFeature * flags.featureMode;
    index += PolylineTechnique._kInstanced * flags.isInstanced;
    return index;
  }
}

class EdgeTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kAnimated = 2;
  private static readonly _kInstanced = 4;
  private static readonly _kFeature = 8;
  private readonly _isSilhouette: boolean;

  public constructor(gl: WebGLRenderingContext, isSilhouette: boolean = false) {
    super(numFeatureVariants(EdgeTechnique._kFeature));
    this._isSilhouette = isSilhouette;

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      for (let iAnimate = IsAnimated.No; iAnimate <= IsAnimated.Yes; iAnimate++) {
        for (const featureMode of featureModes) {
          flags.reset(featureMode, instanced, IsShadowable.No);
          flags.isAnimated = iAnimate;
          const builder = createEdgeBuilder(isSilhouette, flags.isInstanced, flags.isAnimated);
          addMonochrome(builder.frag);

          // The translucent shaders do not need the element IDs.
          const builderTrans = createEdgeBuilder(isSilhouette, flags.isInstanced, flags.isAnimated);
          addMonochrome(builderTrans.frag);
          if (FeatureMode.Overrides === featureMode) {
            addFeatureSymbology(builderTrans, featureMode, FeatureSymbologyOptions.Linear);
            addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.Linear);
            this.addTranslucentShader(builderTrans, flags, gl);
          } else {
            this.addTranslucentShader(builderTrans, flags, gl);
            addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.None);
          }

          this.addFeatureId(builder, featureMode);
          flags.reset(featureMode, instanced, IsShadowable.No);
          flags.isAnimated = iAnimate;
          this.addShader(builder, flags, gl);
        }
      }
    }
    this.verifyShadersContiguous();
  }

  protected get _debugDescription() { return this._isSilhouette ? "Silhouette" : "Edge"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    let index = flags.isTranslucent ? EdgeTechnique._kTranslucent : EdgeTechnique._kOpaque;
    index += EdgeTechnique._kFeature * flags.featureMode;
    if (flags.isAnimated)
      index += EdgeTechnique._kAnimated;
    if (flags.isInstanced)
      index += EdgeTechnique._kInstanced;

    return index;
  }
}

class PointStringTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kInstanced = 2;
  private static readonly _kFeature = 4;
  private static readonly _kHilite = numFeatureVariants(PointStringTechnique._kFeature);

  public constructor(gl: WebGLRenderingContext) {
    super((PointStringTechnique._kHilite + numHiliteVariants));

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createPointStringHiliter);
      for (const featureMode of featureModes) {
        flags.reset(featureMode, instanced, IsShadowable.No);
        const builder = createPointStringBuilder(instanced);
        addMonochrome(builder.frag);

        // The translucent shaders do not need the element IDs.
        const builderTrans = createPointStringBuilder(instanced);
        addMonochrome(builderTrans.frag);
        if (FeatureMode.Overrides === featureMode) {
          addFeatureSymbology(builderTrans, featureMode, FeatureSymbologyOptions.Point);
          addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.Point);
          this.addTranslucentShader(builderTrans, flags, gl);
        } else {
          this.addTranslucentShader(builderTrans, flags, gl);
          addFeatureSymbology(builder, featureMode, FeatureSymbologyOptions.None);
        }

        this.addFeatureId(builder, featureMode);
        flags.reset(featureMode, instanced, IsShadowable.No);
        this.addShader(builder, flags, gl);
      }
    }
    this.verifyShadersContiguous();
  }

  protected get _debugDescription() { return "PointString"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite) {
      assert(flags.hasFeatures);
      return PointStringTechnique._kHilite + flags.isInstanced;
    }

    let index = flags.isTranslucent ? PointStringTechnique._kTranslucent : PointStringTechnique._kOpaque;
    index += PointStringTechnique._kFeature * flags.featureMode;
    index += PointStringTechnique._kInstanced * flags.isInstanced;
    return index;
  }
}

class PointCloudTechnique extends VariedTechnique {

  private static readonly _kHilite = 4;

  public constructor(gl: WebGLRenderingContext) {
    super(PointCloudTechnique._kHilite + 2);
    for (let iClassified = IsClassified.No; iClassified <= IsClassified.Yes; iClassified++) {
      this.addHiliteShader(gl, IsInstanced.No, iClassified, () => createPointCloudHiliter(iClassified));
      const flags = scratchTechniqueFlags;
      const pointCloudFeatureModes = [FeatureMode.None, FeatureMode.Overrides];
      for (const featureMode of pointCloudFeatureModes) {
        flags.reset(featureMode, IsInstanced.No, IsShadowable.No);
        flags.isClassified = iClassified;
        const builder = createPointCloudBuilder(flags.isClassified, featureMode);
        if (FeatureMode.Overrides === featureMode)
          addUniformFeatureSymbology(builder);

        this.addFeatureId(builder, featureMode);
        this.addShader(builder, flags, gl);
      }
    }
    this.verifyShadersContiguous();
  }

  protected get _debugDescription() { return "PointCloud"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite)
      return PointCloudTechnique._kHilite + flags.isClassified;
    else
      return 2 * flags.isClassified + ((flags.featureMode === FeatureMode.None) ? 0 : 1);
  }
}

/** A collection of rendering techniques accessed by ID.
 * @internal
 */
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
      let omitCounter = 0;
      for (const command of commands) {
        const omitStatus = command.getOmitStatus(target);
        if ((omitCounter += omitStatus) !== 0 || omitStatus !== OmitStatus.Neutral)
          continue;
        command.preExecute(executor);
        const techniqueId = command.getTechniqueId(target);
        if (TechniqueId.Invalid !== techniqueId) {
          // A primitive command.
          assert(command.isPrimitiveCommand, "expected primitive command");
          const shadowable = techniqueId === TechniqueId.Surface && target.solarShadowMap !== undefined && target.solarShadowMap.isReady;   // TBD - Avoid shadows for pick?
          flags.init(target, renderPass, IsInstanced.No, IsAnimated.No, target.planarClassifiers.isValid ? IsClassified.Yes : IsClassified.No, shadowable ? IsShadowable.Yes : IsShadowable.No);
          flags.setAnimated(command.hasAnimation);
          flags.setInstanced(command.isInstanced);
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
  public executeForIndexedClassifier(target: Target, cmdsByIndex: DrawCommands, renderPass: RenderPass, index: number, techId?: TechniqueId) {
    assert(RenderPass.None !== renderPass, "invalid render pass");
    // There should be 3 commands per classifier in the cmdsByIndex array.
    index *= 3;
    if (index < 0 || index > cmdsByIndex.length - 3)
      return; // index out of range

    const pushCmd = cmdsByIndex[index];
    const primCmd = cmdsByIndex[index + 1];
    const popCmd = cmdsByIndex[index + 2];

    const flags = this._scratchTechniqueFlags;
    using(new ShaderProgramExecutor(target, renderPass), (executor: ShaderProgramExecutor) => {

      // First execute the push.
      pushCmd.preExecute(executor);
      let techniqueId = pushCmd.getTechniqueId(target);
      assert(TechniqueId.Invalid === techniqueId);
      assert(!pushCmd.isPrimitiveCommand, "expected non-primitive command");
      pushCmd.execute(executor);
      pushCmd.postExecute(executor);

      // Execute the command for the given classification primitive.
      primCmd.preExecute(executor);
      techniqueId = primCmd.getTechniqueId(target);
      assert(TechniqueId.Invalid !== techniqueId);
      // A primitive command.
      assert(primCmd.isPrimitiveCommand, "expected primitive command");
      flags.init(target, renderPass, IsInstanced.No);
      flags.setAnimated(primCmd.hasAnimation);
      const tech = this.getTechnique(undefined !== techId ? techId : techniqueId);
      const program = tech.getShader(flags);
      if (executor.setProgram(program)) {
        primCmd.execute(executor);
      }
      primCmd.postExecute(executor);

      // Execute the batch pop.
      popCmd.preExecute(executor);
      techniqueId = popCmd.getTechniqueId(target);
      assert(TechniqueId.Invalid === techniqueId);
      assert(!popCmd.isPrimitiveCommand, "expected non-primitive command");
      popCmd.execute(executor);
      popCmd.postExecute(executor);
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
    this._list[TechniqueId.ClipMask] = new SingularTechnique(createClipMaskProgram(gl));
    this._list[TechniqueId.SkyBox] = new SingularTechnique(createSkyBoxProgram(gl));
    this._list[TechniqueId.SkySphereGradient] = new SingularTechnique(createSkySphereProgram(gl, true));
    this._list[TechniqueId.SkySphereTexture] = new SingularTechnique(createSkySphereProgram(gl, false));
    this._list[TechniqueId.AmbientOcclusion] = new SingularTechnique(createAmbientOcclusionProgram(gl));
    this._list[TechniqueId.Blur] = new SingularTechnique(createBlurProgram(gl));
    this._list[TechniqueId.CombineTextures] = new SingularTechnique(createCombineTexturesProgram(gl));
    this._list[TechniqueId.Surface] = new SurfaceTechnique(gl);
    this._list[TechniqueId.Edge] = new EdgeTechnique(gl, false);
    this._list[TechniqueId.SilhouetteEdge] = new EdgeTechnique(gl, true);
    this._list[TechniqueId.Polyline] = new PolylineTechnique(gl);
    this._list[TechniqueId.PointString] = new PointStringTechnique(gl);
    this._list[TechniqueId.PointCloud] = new PointCloudTechnique(gl);

    for (let compositeFlags = 1; compositeFlags <= 7; compositeFlags++) {
      const techId = computeCompositeTechniqueId(compositeFlags);
      this._list[techId] = new SingularTechnique(createCompositeProgram(compositeFlags, gl));
    }

    assert(this._list.length === TechniqueId.NumBuiltIn, "unexpected number of built-in techniques");
  }
}

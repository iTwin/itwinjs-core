/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, using, dispose } from "@bentley/bentleyjs-core";
import { ShaderProgram, ShaderProgramExecutor, CompileStatus } from "./ShaderProgram";
import { TechniqueId, computeCompositeTechniqueId } from "./TechniqueId";
import { HasMaterialAtlas, IsInstanced, IsAnimated, IsClassified, IsShadowable, TechniqueFlags, FeatureMode, ClipDef, IsEdgeTestNeeded } from "./TechniqueFlags";
import { ProgramBuilder, ClippingShaders } from "./ShaderBuilder";
import { DrawParams, DrawCommands } from "./DrawCommand";
import { Target } from "./Target";
import { RenderPass } from "./RenderFlags";
import { createClearTranslucentProgram } from "./glsl/ClearTranslucent";
import { createClearPickAndColorProgram } from "./glsl/ClearPickAndColor";
import { createCopyColorProgram } from "./glsl/CopyColor";
import { createCopyPickBuffersProgram } from "./glsl/CopyPickBuffers";
import { createVolClassCopyZProgram, createVolClassSetBlendProgram, createVolClassBlendProgram, createVolClassColorUsingStencilProgram, createVolClassCopyZUsingPointsProgram } from "./glsl/CopyStencil";
import { createCompositeProgram } from "./glsl/Composite";
import { createClipMaskProgram } from "./glsl/ClipMask";
import { createEVSMProgram } from "./glsl/EVSMFromDepth";
import { addTranslucency } from "./glsl/Translucency";
import { addUnlitMonochrome } from "./glsl/Monochrome";
import { createSurfaceBuilder, createSurfaceHiliter } from "./glsl/Surface";
import { createPointStringBuilder, createPointStringHiliter } from "./glsl/PointString";
import { createPointCloudBuilder, createPointCloudHiliter } from "./glsl/PointCloud";
import createTerrainMeshBuilder from "./glsl/TerrainMesh";
import { addFeatureId, addFeatureSymbology, addUniformFeatureSymbology, addRenderOrder, FeatureSymbologyOptions } from "./glsl/FeatureSymbology";
import { addFragColorWithPreMultipliedAlpha, addPickBufferOutputs } from "./glsl/Fragment";
import { addFrustum, addEyeSpace, addShaderFlags } from "./glsl/Common";
import { addModelViewMatrix } from "./glsl/Vertex";
import { createPolylineBuilder, createPolylineHiliter } from "./glsl/Polyline";
import { createEdgeBuilder } from "./glsl/Edge";
import { createSkyBoxProgram } from "./glsl/SkyBox";
import { createSkySphereProgram } from "./glsl/SkySphere";
import { createAmbientOcclusionProgram } from "./glsl/AmbientOcclusion";
import { createBlurProgram } from "./glsl/Blur";
import { createCombineTexturesProgram } from "./glsl/CombineTextures";
import { addLogDepth } from "./glsl/LogarithmicDepthBuffer";
import { System } from "./System";
import { WebGLDisposable } from "./Disposable";

/** Defines a rendering technique implemented using one or more shader programs.
 * @internal
 */
export interface Technique extends WebGLDisposable {
  getShader(flags: TechniqueFlags): ShaderProgram;
  getShaderByIndex(index: number): ShaderProgram;
  getShaderCount(): number;

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
  public getShaderByIndex(_index: number) { return this.program; }
  public getShaderCount() { return 1; }
  public compileShaders(): boolean { return this.program.compile() === CompileStatus.Success; }

  public get isDisposed(): boolean { return this.program.isDisposed; }

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
  private readonly _offsetToLogZPrograms: number;

  public compileShaders(): boolean {
    let allCompiled = true;
    for (const program of this._basicPrograms) {
      if (program.compile() !== CompileStatus.Success)
        allCompiled = false;
    }

    for (const clipProg of this._clippingPrograms) {
      if (!clipProg.compileShaders())
        allCompiled = false;
    }

    return allCompiled;
  }

  protected verifyShadersContiguous(): void {
    let emptyShaderIndex = -1;
    assert(-1 === (emptyShaderIndex = this._basicPrograms.findIndex((prog) => undefined === prog)), "Shader index " + emptyShaderIndex + " is undefined in " + this.constructor.name);
  }

  private _isDisposed = false;
  public get isDisposed(): boolean { return this._isDisposed; }

  public dispose(): void {
    if (this._isDisposed)
      return;
    for (const program of this._basicPrograms) {
      assert(undefined !== program);
      dispose(program);
    }

    this._basicPrograms.length = 0;
    for (const clipShaderObj of this._clippingPrograms) {
      assert(undefined !== clipShaderObj);
      dispose(clipShaderObj.maskShader);

      for (const clipShader of clipShaderObj.shaders) {
        assert(undefined !== clipShader);
        dispose(clipShader);
      }

      clipShaderObj.shaders.length = 0;
      clipShaderObj.maskShader = undefined;
      this._isDisposed = true;
    }
  }

  protected constructor(numPrograms: number) {
    this._basicPrograms.length = numPrograms;
    this._offsetToLogZPrograms = System.instance.supportsLogZBuffer ? numPrograms : 0;
  }

  protected abstract computeShaderIndex(flags: TechniqueFlags): number;
  protected abstract get _debugDescription(): string;

  protected addShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    const descr = this._debugDescription + ": " + flags.buildDescription();
    builder.setDebugDescription(descr);

    const index = this.getShaderIndex(flags);
    this.addProgram(builder, index, gl, !flags.isClassified);
    if (System.instance.supportsLogZBuffer) {
      const withLogZ = builder.clone();
      addLogDepth(withLogZ);
      this.addProgram(withLogZ, index + this._offsetToLogZPrograms, gl, !flags.isClassified);
    }
  }

  private addProgram(builder: ProgramBuilder, index: number, gl: WebGLRenderingContext | WebGL2RenderingContext, wantClippingMask: boolean): void {
    assert(this._basicPrograms[index] === undefined);
    this._basicPrograms[index] = builder.buildProgram(gl);
    assert(this._basicPrograms[index] !== undefined);

    assert(this._clippingPrograms[index] === undefined);
    this._clippingPrograms[index] = new ClippingShaders(builder, gl, wantClippingMask);
    assert(this._clippingPrograms[index] !== undefined);
  }

  protected addHiliteShader(gl: WebGLRenderingContext | WebGL2RenderingContext, instanced: IsInstanced, classified: IsClassified, create: (instanced: IsInstanced, classified: IsClassified) => ProgramBuilder): void {
    const builder = create(instanced, classified);
    scratchHiliteFlags.initForHilite(new ClipDef(), instanced, classified, false);
    this.addShader(builder, scratchHiliteFlags, gl);
  }

  protected addTranslucentShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    flags.isTranslucent = true;
    addTranslucency(builder);
    this.addShader(builder, flags, gl);
  }

  protected addFeatureId(builder: ProgramBuilder, feat: FeatureMode) {
    const frag = builder.frag;
    if (FeatureMode.None === feat) {
      addFragColorWithPreMultipliedAlpha(frag);
    } else {
      const vert = builder.vert;
      addFrustum(builder);
      addEyeSpace(builder);
      addModelViewMatrix(vert);
      addRenderOrder(frag);
      addFeatureId(builder, false);
      addPickBufferOutputs(frag);
    }
  }

  private getShaderIndex(flags: TechniqueFlags) {
    assert(!flags.isHilite || (!flags.isTranslucent && (flags.isClassified === IsClassified.Yes || flags.hasFeatures)), "invalid technique flags");
    let index = this.computeShaderIndex(flags);
    if (flags.usesLogZ)
      index += this._offsetToLogZPrograms;

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

  // NB: Will ignore clipping shaders.
  public getShaderByIndex(index: number): ShaderProgram {
    return this._basicPrograms[index];
  }

  // NB: Will ignore clipping shaders.
  public getShaderCount(): number {
    return this._basicPrograms.length;
  }
}

class SurfaceTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kInstanced = 2;
  private static readonly _kMaterialAtlas = 4;
  private static readonly _kAnimated = 8;
  private static readonly _kShadowable = 16;
  private static readonly _kFeature = 32;
  private static readonly _kEdgeTestNeeded = 96; // only when hasFeatures
  private static readonly _kHilite = 160;
  // Classifiers are never animated or instanced. They do support shadows and translucency.
  // There are 3 base variations - 1 per feature mode - each with translucent and/or shadowed variants; plus 1 for hilite.
  private static readonly _kClassified = SurfaceTechnique._kHilite + numHiliteVariants;

  public constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    super(SurfaceTechnique._kClassified + 13);
    const flags = scratchTechniqueFlags;

    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createSurfaceHiliter);
      for (let iAnimate = IsAnimated.No; iAnimate <= IsAnimated.Yes; iAnimate++) {
        for (let shadowable = IsShadowable.No; shadowable <= IsShadowable.Yes; shadowable++) {
          for (let hasMaterialAtlas = HasMaterialAtlas.No; hasMaterialAtlas <= HasMaterialAtlas.Yes; hasMaterialAtlas++) {
            for (let edgeTestNeeded = IsEdgeTestNeeded.No; edgeTestNeeded <= IsEdgeTestNeeded.Yes; edgeTestNeeded++) {
              for (const featureMode of featureModes) {
                for (let iTranslucent = 0; iTranslucent <= 1; iTranslucent++) {
                  if (FeatureMode.None !== featureMode || IsEdgeTestNeeded.No === edgeTestNeeded) {
                    flags.reset(featureMode, instanced, shadowable);
                    flags.isAnimated = iAnimate;
                    flags.isEdgeTestNeeded = edgeTestNeeded;
                    flags.hasMaterialAtlas = hasMaterialAtlas;
                    flags.isTranslucent = 1 === iTranslucent;

                    const builder = createSurfaceBuilder(flags);
                    this.addShader(builder, flags, gl);
                  }
                }
              }
            }
          }
        }
      }
    }

    this.addHiliteShader(gl, IsInstanced.No, IsClassified.Yes, createSurfaceHiliter);
    for (let translucent = 0; translucent < 2; translucent++) {
      for (let shadowable = IsShadowable.No; shadowable <= IsShadowable.Yes; shadowable++) {
        for (const featureMode of featureModes) {
          flags.reset(featureMode, IsInstanced.No, shadowable);
          flags.isClassified = IsClassified.Yes;
          flags.isTranslucent = (0 !== translucent);

          const builder = createSurfaceBuilder(flags);
          if (flags.isTranslucent)
            addTranslucency(builder);

          this.addShader(builder, flags, gl);
        }
      }
    }

    this.verifyShadersContiguous();
  }

  protected get _debugDescription() { return "Surface"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isClassified) {
      assert(!flags.isAnimated);
      assert(!flags.isInstanced);
      assert(!flags.isEdgeTestNeeded);

      // First classified shader is for hilite
      if (flags.isHilite)
        return SurfaceTechnique._kClassified;

      // The rest are organized in 3 groups of four - one group per feature mode.
      // Each group contains opaque, translucent, shadowable, and translucent+shadowable variants.
      let baseIndex = SurfaceTechnique._kClassified + 1;
      if (flags.isTranslucent)
        baseIndex += 1;
      if (flags.isShadowable)
        baseIndex += 2;

      const featureOffset = 4 * flags.featureMode;
      return baseIndex + featureOffset;
    } else if (flags.isHilite) {
      assert(flags.hasFeatures);
      return SurfaceTechnique._kHilite + flags.isInstanced;
    }

    assert(flags.hasFeatures || flags.isEdgeTestNeeded === IsEdgeTestNeeded.No);
    let index = flags.isTranslucent ? SurfaceTechnique._kTranslucent : SurfaceTechnique._kOpaque;
    index += SurfaceTechnique._kInstanced * flags.isInstanced;
    index += SurfaceTechnique._kMaterialAtlas * flags.hasMaterialAtlas;
    index += SurfaceTechnique._kAnimated * flags.isAnimated;
    index += SurfaceTechnique._kShadowable * flags.isShadowable;

    if (flags.isEdgeTestNeeded)
      index += SurfaceTechnique._kEdgeTestNeeded + (flags.featureMode - 1) * SurfaceTechnique._kFeature;
    else
      index += SurfaceTechnique._kFeature * flags.featureMode;

    return index;
  }
}

class PolylineTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kInstanced = 2;
  private static readonly _kFeature = 4;
  private static readonly _kHilite = numFeatureVariants(PolylineTechnique._kFeature);

  public constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    super(PolylineTechnique._kHilite + numHiliteVariants);

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createPolylineHiliter);
      for (const featureMode of featureModes) {
        flags.reset(featureMode, instanced, IsShadowable.No);
        const builder = createPolylineBuilder(instanced);
        addUnlitMonochrome(builder.frag);

        // The translucent shaders do not need the element IDs.
        const builderTrans = createPolylineBuilder(instanced);
        addUnlitMonochrome(builderTrans.frag);
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

  public constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, isSilhouette: boolean = false) {
    super(numFeatureVariants(EdgeTechnique._kFeature));
    this._isSilhouette = isSilhouette;

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      for (let iAnimate = IsAnimated.No; iAnimate <= IsAnimated.Yes; iAnimate++) {
        for (const featureMode of featureModes) {
          flags.reset(featureMode, instanced, IsShadowable.No);
          flags.isAnimated = iAnimate;
          const builder = createEdgeBuilder(isSilhouette, flags.isInstanced, flags.isAnimated);
          addUnlitMonochrome(builder.frag);

          // The translucent shaders do not need the element IDs.
          const builderTrans = createEdgeBuilder(isSilhouette, flags.isInstanced, flags.isAnimated);
          addUnlitMonochrome(builderTrans.frag);
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

  public constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    super((PointStringTechnique._kHilite + numHiliteVariants));

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createPointStringHiliter);
      for (const featureMode of featureModes) {
        flags.reset(featureMode, instanced, IsShadowable.No);
        const builder = createPointStringBuilder(instanced);
        addUnlitMonochrome(builder.frag);

        // The translucent shaders do not need the element IDs.
        const builderTrans = createPointStringBuilder(instanced);
        addUnlitMonochrome(builderTrans.frag);
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

  public constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
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

class TerrainMeshTechnique extends VariedTechnique {
  private static readonly _numVariants = 16;

  public constructor(gl: WebGLRenderingContext) {
    super(TerrainMeshTechnique._numVariants);
    for (let iClassified = IsClassified.No; iClassified <= IsClassified.Yes; iClassified++) {
      for (let iTranslucent = 0; iTranslucent <= 1; iTranslucent++) {
        for (let shadowable = IsShadowable.No; shadowable <= IsShadowable.Yes; shadowable++) {
          const flags = scratchTechniqueFlags;
          const terrainMeshFeatureModes = [FeatureMode.None, FeatureMode.Pick];
          for (const featureMode of terrainMeshFeatureModes) {
            flags.reset(featureMode, IsInstanced.No, shadowable);
            flags.isClassified = iClassified;
            flags.isTranslucent = 1 === iTranslucent;
            const builder = createTerrainMeshBuilder(flags.isClassified, featureMode, flags.isShadowable);
            if (FeatureMode.Pick === featureMode)
              addUniformFeatureSymbology(builder);
            if (flags.isTranslucent) {
              addShaderFlags(builder);
              addTranslucency(builder);
            } else
              this.addFeatureId(builder, featureMode);
            this.addShader(builder, flags, gl);
          }
        }
      }
    }
    this.verifyShadersContiguous();
  }

  protected get _debugDescription() { return "TerrainMesh"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    let ndx = 0;
    if (flags.isClassified)
      ndx++;
    if (flags.isShadowable)
      ndx += 2;
    if (flags.isTranslucent)
      ndx += 4;
    if (flags.featureMode !== FeatureMode.None)
      ndx += 8;
    return ndx;
  }
}

interface PrioritizedShaderVariation {
  featureMode: FeatureMode;
  isInstanced: IsInstanced;
  isShadowable: IsShadowable;
  isEdgeTestedNeeded: IsEdgeTestNeeded;
  usesLogZ: boolean;
  isTranslucent: boolean;
}

interface PrioritizedTechniqueOrShader {
  techniqueId: TechniqueId;
  specificShader?: PrioritizedShaderVariation; // if defined, only compile this specific shader variation for the technique; otherwise, compile all uncompiled shader variations for the technique
}

const _techniquesByPriority: PrioritizedTechniqueOrShader[] = [
  // Compile these specific shader variations first because they seem most likely to be used immediately upon opening a file.
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.None, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: true, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: true, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, usesLogZ: true, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: true, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, usesLogZ: true, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.None, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: false, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: false, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, usesLogZ: false, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: false, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, usesLogZ: false, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.None, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: true, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: true, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, usesLogZ: true, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: true, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, usesLogZ: true, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.None, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: false, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: false, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, usesLogZ: false, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, usesLogZ: false, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, usesLogZ: false, isTranslucent: true } },

  // Next, compile all shaders in specific techniques.
  // Do surfaces first because (1) they are the most commonly used and (2) they take longer to compile.
  { techniqueId: TechniqueId.Surface },
  { techniqueId: TechniqueId.Edge },
  { techniqueId: TechniqueId.SilhouetteEdge },
  { techniqueId: TechniqueId.Polyline },
  { techniqueId: TechniqueId.PointString },
  { techniqueId: TechniqueId.PointCloud },
  { techniqueId: TechniqueId.TerrainMesh },

  // The following techniques take a trivial amount of time to compile - do them last
  { techniqueId: TechniqueId.OITClearTranslucent },
  { techniqueId: TechniqueId.CopyPickBuffers },
  { techniqueId: TechniqueId.CopyColor },
  { techniqueId: TechniqueId.CopyColorNoAlpha },
  { techniqueId: TechniqueId.ClearPickAndColor },
  { techniqueId: TechniqueId.CompositeTranslucent },
  { techniqueId: TechniqueId.CompositeHilite },
  { techniqueId: TechniqueId.CompositeHiliteAndTranslucent },
  { techniqueId: TechniqueId.CompositeOcclusion },
  { techniqueId: TechniqueId.CompositeTranslucentAndOcclusion },
  { techniqueId: TechniqueId.CompositeHiliteAndOcclusion },
  { techniqueId: TechniqueId.CompositeAll },
  { techniqueId: TechniqueId.VolClassColorUsingStencil },
  { techniqueId: TechniqueId.ClipMask },
  { techniqueId: TechniqueId.EVSMFromDepth },
  { techniqueId: TechniqueId.SkyBox },
  { techniqueId: TechniqueId.SkySphereGradient },
  { techniqueId: TechniqueId.SkySphereTexture },
  { techniqueId: TechniqueId.AmbientOcclusion },
  { techniqueId: TechniqueId.Blur },
  { techniqueId: TechniqueId.CombineTextures },
  { techniqueId: TechniqueId.VolClassCopyZ },
  { techniqueId: TechniqueId.VolClassSetBlend },
  { techniqueId: TechniqueId.VolClassBlend },
];
const _numTechniquesByPriority = _techniquesByPriority.length;

/** A collection of rendering techniques accessed by ID.
 * @internal
 */
export class Techniques implements WebGLDisposable {
  private readonly _list = new Array<Technique>(); // indexed by TechniqueId, which may exceed TechniqueId.NumBuiltIn for dynamic techniques.
  private readonly _dynamicTechniqueIds = new Array<string>(); // technique ID = (index in this array) + TechniqueId.NumBuiltIn
  private _techniqueByPriorityIndex = 0;
  private _shaderIndex = 0;

  public static create(gl: WebGLRenderingContext | WebGL2RenderingContext): Techniques {
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

  /** Execute each command in the list */
  public execute(target: Target, commands: DrawCommands, renderPass: RenderPass) {
    assert(RenderPass.None !== renderPass, "invalid render pass");

    using(new ShaderProgramExecutor(target, renderPass), (executor: ShaderProgramExecutor) => {
      for (const command of commands)
        command.execute(executor);
    });
  }

  /** Execute the commands for a single given classification primitive (the first 3 commands should be a push, the primitive, then a pop) */
  public executeForIndexedClassifier(target: Target, cmdsByIndex: DrawCommands, renderPass: RenderPass) {
    // ###TODO: Disable shadows. Probably in the ClassifierTileTree's ViewFlagOverrides.
    this.execute(target, cmdsByIndex, renderPass);
  }

  /** Draw a single primitive. Usually used for special-purpose rendering techniques. */
  public draw(params: DrawParams): void {
    const tech = this.getTechnique(params.geometry.techniqueId);
    const program = tech.getShader(TechniqueFlags.defaults);
    using(new ShaderProgramExecutor(params.target, params.renderPass, program), (executor: ShaderProgramExecutor) => {
      assert(executor.isValid);
      if (executor.isValid) {
        executor.draw(params);
      }
    });
  }

  public get isDisposed(): boolean { return 0 === this._list.length; }

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

  /** Compile shader of next highest priority. Called when possible during an idle situation before any viewports exist. */
  public idleCompileNextShader(): boolean {
    let compileStatus = CompileStatus.Success;
    let wasPreviouslyCompiled = false;

    do {
      if (this._techniqueByPriorityIndex >= _numTechniquesByPriority)
        return false;

      let shader: ShaderProgram;
      let numShaders = 0;

      const pTech = _techniquesByPriority[this._techniqueByPriorityIndex];
      const tech = this._list[pTech.techniqueId];

      if (pTech.specificShader !== undefined) { // if this entry consists of a specific shader, just compile that
        const flags = scratchTechniqueFlags;
        flags.reset(pTech.specificShader.featureMode, pTech.specificShader.isInstanced, pTech.specificShader.isShadowable);
        flags.isEdgeTestNeeded = pTech.specificShader.isEdgeTestedNeeded;
        flags.usesLogZ = pTech.specificShader.usesLogZ;
        flags.isTranslucent = pTech.specificShader.isTranslucent;
        shader = tech.getShader(flags);
      } else { // if this entry only contains a techniqueId, then compile all uncompiled shaders for that technique
        shader = tech.getShaderByIndex(this._shaderIndex);
        this._shaderIndex++;
        numShaders = tech.getShaderCount();
      }

      if (shader.isCompiled)
        wasPreviouslyCompiled = true;
      else {
        compileStatus = shader.compile();
        wasPreviouslyCompiled = false;
      }

      if (this._shaderIndex >= numShaders) {
        this._techniqueByPriorityIndex++;
        this._shaderIndex = 0;
      }
    } while (wasPreviouslyCompiled);

    return compileStatus === CompileStatus.Success;
  }

  private constructor() { }

  private initializeBuiltIns(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this._list[TechniqueId.OITClearTranslucent] = new SingularTechnique(createClearTranslucentProgram(gl));
    this._list[TechniqueId.ClearPickAndColor] = new SingularTechnique(createClearPickAndColorProgram(gl));
    this._list[TechniqueId.CopyColor] = new SingularTechnique(createCopyColorProgram(gl));
    this._list[TechniqueId.CopyColorNoAlpha] = new SingularTechnique(createCopyColorProgram(gl, false));
    this._list[TechniqueId.CopyPickBuffers] = new SingularTechnique(createCopyPickBuffersProgram(gl));
    this._list[TechniqueId.ClipMask] = new SingularTechnique(createClipMaskProgram(gl));
    this._list[TechniqueId.EVSMFromDepth] = new SingularTechnique(createEVSMProgram(gl));
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
    this._list[TechniqueId.TerrainMesh] = new TerrainMeshTechnique(gl);
    if (System.instance.capabilities.supportsFragDepth)
      this._list[TechniqueId.VolClassCopyZ] = new SingularTechnique(createVolClassCopyZProgram(gl));
    else
      this._list[TechniqueId.VolClassCopyZ] = new SingularTechnique(createVolClassCopyZUsingPointsProgram(gl));
    this._list[TechniqueId.VolClassSetBlend] = new SingularTechnique(createVolClassSetBlendProgram(gl));
    this._list[TechniqueId.VolClassBlend] = new SingularTechnique(createVolClassBlendProgram(gl));
    this._list[TechniqueId.VolClassColorUsingStencil] = new SingularTechnique(createVolClassColorUsingStencilProgram(gl));

    for (let compositeFlags = 1; compositeFlags <= 7; compositeFlags++) {
      const techId = computeCompositeTechniqueId(compositeFlags);
      this._list[techId] = new SingularTechnique(createCompositeProgram(compositeFlags, gl));
    }

    assert(this._list.length === TechniqueId.NumBuiltIn, "unexpected number of built-in techniques");
  }
}

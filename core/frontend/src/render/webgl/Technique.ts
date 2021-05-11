/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, using } from "@bentley/bentleyjs-core";
import { WebGLContext } from "@bentley/webgl-compatibility";
import { ClippingProgram, createClippingProgram } from "./ClippingProgram";
import { WebGLDisposable } from "./Disposable";
import { DrawCommands, DrawParams } from "./DrawCommand";
import { createAmbientOcclusionProgram } from "./glsl/AmbientOcclusion";
import { createBlurProgram } from "./glsl/Blur";
import { createClearPickAndColorProgram } from "./glsl/ClearPickAndColor";
import { createClearTranslucentProgram } from "./glsl/ClearTranslucent";
import { createCombine3TexturesProgram } from "./glsl/Combine3Textures";
import { createCombineTexturesProgram } from "./glsl/CombineTextures";
import { addEyeSpace, addFrustum, addShaderFlags } from "./glsl/Common";
import { createCompositeProgram } from "./glsl/Composite";
import { createCopyColorProgram } from "./glsl/CopyColor";
import { createCopyPickBuffersProgram } from "./glsl/CopyPickBuffers";
import {
  createVolClassBlendProgram, createVolClassColorUsingStencilProgram, createVolClassCopyZProgram, createVolClassCopyZUsingPointsProgram,
  createVolClassSetBlendProgram,
} from "./glsl/CopyStencil";
import { createEdgeBuilder } from "./glsl/Edge";
import { createEVSMProgram } from "./glsl/EVSMFromDepth";
import { addFeatureId, addFeatureSymbology, addRenderOrder, addUniformFeatureSymbology, FeatureSymbologyOptions } from "./glsl/FeatureSymbology";
import { addFragColorWithPreMultipliedAlpha, addPickBufferOutputs } from "./glsl/Fragment";
import { addLogDepth } from "./glsl/LogarithmicDepthBuffer";
import { addUnlitMonochrome } from "./glsl/Monochrome";
import createPlanarGridProgram from "./glsl/PlanarGrid";
import { createPointCloudBuilder, createPointCloudHiliter } from "./glsl/PointCloud";
import { createPointStringBuilder, createPointStringHiliter } from "./glsl/PointString";
import { createPolylineBuilder, createPolylineHiliter } from "./glsl/Polyline";
import createRealityMeshBuilder, { createClassifierRealityMeshHiliter, createRealityMeshHiliter } from "./glsl/RealityMesh";
import { createSkyBoxProgram } from "./glsl/SkyBox";
import { createSkySphereProgram } from "./glsl/SkySphere";
import { createSurfaceBuilder, createSurfaceHiliter } from "./glsl/Surface";
import { addTranslucency } from "./glsl/Translucency";
import { addModelViewMatrix } from "./glsl/Vertex";
import { RenderPass } from "./RenderFlags";
import { ProgramBuilder } from "./ShaderBuilder";
import { CompileStatus, ShaderProgram, ShaderProgramExecutor } from "./ShaderProgram";
import { System } from "./System";
import { Target } from "./Target";
import {
  FeatureMode, IsAnimated, IsClassified, IsEdgeTestNeeded, IsInstanced, IsShadowable, IsThematic, TechniqueFlags,
} from "./TechniqueFlags";
import { computeCompositeTechniqueId, TechniqueId } from "./TechniqueId";

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
  private readonly _clippingPrograms: ClippingProgram[] = [];

  /** TechniqueFlags identifying shader programs for which the fragment shader writes depth but does not contain any discards.
   * Buggy Intel HD 620/630 drivers incorrectly apply early-Z optimization in this case; we must insert a never-executed
   * conditional discard to prevent that.
   */
  protected _earlyZFlags: TechniqueFlags[] = [];

  public compileShaders(): boolean {
    let allCompiled = true;
    for (const program of this._basicPrograms) {
      if (program.compile() !== CompileStatus.Success)
        allCompiled = false;
    }

    for (const clipper of this._clippingPrograms)
      if (!clipper.compile())
        allCompiled = false;

    return allCompiled;
  }

  protected finishConstruction(): void {
    this._earlyZFlags.length = 0;

    // Confirm no empty entries in our array.
    let emptyShaderIndex = -1;
    assert(-1 === (emptyShaderIndex = this._basicPrograms.findIndex((prog) => undefined === prog)), `Shader index ${emptyShaderIndex} is undefined in ${this.constructor.name}`);
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
      clipShaderObj.dispose();
    }

    this._clippingPrograms.length = 0;
    this._isDisposed = true;
  }

  protected constructor(numPrograms: number) {
    this._basicPrograms.length = numPrograms;
  }

  protected abstract computeShaderIndex(flags: TechniqueFlags): number;
  protected abstract get _debugDescription(): string;

  protected addShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLContext): void {
    const descr = `${this._debugDescription}: ${flags.buildDescription()}`;
    builder.setDebugDescription(descr);

    if (System.instance.supportsLogZBuffer) {
      addLogDepth(builder);

      assert(!builder.frag.requiresEarlyZWorkaround);
      if (System.instance.capabilities.driverBugs.fragDepthDoesNotDisableEarlyZ)
        builder.frag.requiresEarlyZWorkaround = -1 !== this._earlyZFlags.findIndex((x) => x.equals(flags));
    }

    const index = this.getShaderIndex(flags);
    this.addProgram(builder, index, gl);

    assert(!builder.frag.requiresEarlyZWorkaround);
  }

  private addProgram(builder: ProgramBuilder, index: number, gl: WebGLContext): void {
    assert(this._basicPrograms[index] === undefined);
    this._basicPrograms[index] = builder.buildProgram(gl);
    assert(this._basicPrograms[index] !== undefined);

    // Clipping programs always include a discard, so never require workaround.
    builder.frag.requiresEarlyZWorkaround = false;

    assert(this._clippingPrograms[index] === undefined);
    this._clippingPrograms[index] = createClippingProgram(builder);
    assert(this._clippingPrograms[index] !== undefined);
  }

  protected addHiliteShader(gl: WebGLContext, instanced: IsInstanced, classified: IsClassified, create: (instanced: IsInstanced, classified: IsClassified) => ProgramBuilder): void {
    const builder = create(instanced, classified);
    scratchHiliteFlags.initForHilite(0, instanced, classified);
    this.addShader(builder, scratchHiliteFlags, gl);
  }

  protected addTranslucentShader(builder: ProgramBuilder, flags: TechniqueFlags, gl: WebGLContext): void {
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
      program = entry.getProgram(flags.numClipPlanes);
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

  /** For tests. */
  public forEachProgram(func: (program: ShaderProgram) => void): void {
    for (const basic of this._basicPrograms)
      func(basic);

    for (const clip of this._clippingPrograms) {
      const prog = clip.getProgram(1);
      assert(undefined !== prog);
      func(prog);
    }
  }
}

class SurfaceTechnique extends VariedTechnique {
  private static readonly _kOpaque = 0;
  private static readonly _kTranslucent = 1;
  private static readonly _kInstanced = 2;
  private static readonly _kAnimated = 4;
  private static readonly _kShadowable = 8;
  private static readonly _kThematic = 16;
  private static readonly _kFeature = 24;
  private static readonly _kEdgeTestNeeded = SurfaceTechnique._kFeature * 3; // only when hasFeatures
  private static readonly _kHilite = SurfaceTechnique._kEdgeTestNeeded + SurfaceTechnique._kFeature * 2;
  // Classifiers are never animated or instanced. They do support shadows, thematic display, and translucency.
  // There are 3 base variations - 1 per feature mode - each with translucent/shadowed/thematic variants; plus 1 for hilite.
  private static readonly _kClassified = SurfaceTechnique._kHilite + numHiliteVariants;

  public constructor(gl: WebGLContext) {
    // 3 base classified variations - 1 per feature mode.
    // Plus thematic variant of each and shadowable variant of each = 9
    // Plus translucent variant of each of those = 18
    // Plus 1 hilite shader = 19
    super(SurfaceTechnique._kClassified + 19);

    this._earlyZFlags = [
      TechniqueFlags.fromDescription("Opaque"),
      TechniqueFlags.fromDescription("Opaque-Animated"),
      TechniqueFlags.fromDescription("Opaque-Animated-Shadowable"),
      TechniqueFlags.fromDescription("Opaque-Hilite-Classified"),
      TechniqueFlags.fromDescription("Opaque-Hilite-Overrides"),
      TechniqueFlags.fromDescription("Opaque-Instanced"),
      TechniqueFlags.fromDescription("Opaque-Instanced-Animated"),
      TechniqueFlags.fromDescription("Opaque-Instanced-Animated-Shadowable"),
      TechniqueFlags.fromDescription("Opaque-Instanced-Hilite-Overrides"),
      TechniqueFlags.fromDescription("Opaque-Instanced-Shadowable"),
      TechniqueFlags.fromDescription("Opaque-Shadowable"),
      TechniqueFlags.fromDescription("Translucent"),
      TechniqueFlags.fromDescription("Translucent-Animated"),
      TechniqueFlags.fromDescription("Translucent-Animated-Overrides"),
      TechniqueFlags.fromDescription("Translucent-Animated-Pick"),
      TechniqueFlags.fromDescription("Translucent-Animated-Shadowable"),
      TechniqueFlags.fromDescription("Translucent-Animated-Shadowable-Overrides"),
      TechniqueFlags.fromDescription("Translucent-Animated-Shadowable-Pick"),
      TechniqueFlags.fromDescription("Translucent-Instanced"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Animated"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Animated-Overrides"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Animated-Pick"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Animated-Shadowable"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Animated-Shadowable-Overrides"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Animated-Shadowable-Pick"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Overrides"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Pick"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Shadowable"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Shadowable-Overrides"),
      TechniqueFlags.fromDescription("Translucent-Instanced-Shadowable-Pick"),
      TechniqueFlags.fromDescription("Translucent-Overrides"),
      TechniqueFlags.fromDescription("Translucent-Pick"),
      TechniqueFlags.fromDescription("Translucent-Shadowable"),
      TechniqueFlags.fromDescription("Translucent-Shadowable-Overrides"),
      TechniqueFlags.fromDescription("Translucent-Shadowable-Pick"),
    ];

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createSurfaceHiliter);
      for (let iAnimate = IsAnimated.No; iAnimate <= IsAnimated.Yes; iAnimate++) {
        for (let shadowable = IsShadowable.No; shadowable <= IsShadowable.Yes; shadowable++) {
          for (let thematic = IsThematic.No; thematic <= IsThematic.Yes; thematic++) {
            for (let edgeTestNeeded = IsEdgeTestNeeded.No; edgeTestNeeded <= IsEdgeTestNeeded.Yes; edgeTestNeeded++) {
              for (const featureMode of featureModes) {
                for (let iTranslucent = 0; iTranslucent <= 1; iTranslucent++) {
                  if (FeatureMode.None !== featureMode || IsEdgeTestNeeded.No === edgeTestNeeded) {
                    if (IsThematic.Yes === thematic && IsShadowable.Yes === shadowable)
                      continue; // currently this combination is disallowed.

                    flags.reset(featureMode, instanced, shadowable, thematic);
                    flags.isAnimated = iAnimate;
                    flags.isEdgeTestNeeded = edgeTestNeeded;
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
        for (let thematic = IsThematic.No; thematic <= IsThematic.Yes; thematic++) {
          for (const featureMode of featureModes) {
            if (IsThematic.Yes === thematic && IsShadowable.Yes === shadowable)
              continue; // currently this combination is disallowed.

            flags.reset(featureMode, IsInstanced.No, shadowable, thematic);
            flags.isClassified = IsClassified.Yes;
            flags.isTranslucent = (0 !== translucent);

            const builder = createSurfaceBuilder(flags);
            if (flags.isTranslucent)
              addTranslucency(builder);

            this.addShader(builder, flags, gl);
          }
        }
      }
    }

    this.finishConstruction();
  }

  protected get _debugDescription() { return "Surface"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    assert(!(flags.isThematic && flags.isShadowable));

    if (flags.isClassified) {
      assert(!flags.isAnimated);
      assert(!flags.isInstanced);
      assert(!flags.isEdgeTestNeeded);

      // First classified shader is for hilite
      if (flags.isHilite)
        return SurfaceTechnique._kClassified;

      // The rest are organized in 3 groups of 6 - one group per feature mode.
      // Each group contains opaque, translucent, opaque+thematic, translucent+thematic, opaque+shadowable, and translucent+shadowable variants.
      let baseIndex = SurfaceTechnique._kClassified + 1;
      if (flags.isTranslucent)
        baseIndex += 1;
      if (flags.isShadowable)
        baseIndex += 2;
      if (flags.isThematic)
        baseIndex += 4;

      const featureOffset = 6 * flags.featureMode;
      return baseIndex + featureOffset;
    } else if (flags.isHilite) {
      assert(flags.hasFeatures);
      return SurfaceTechnique._kHilite + flags.isInstanced;
    }

    assert(flags.hasFeatures || flags.isEdgeTestNeeded === IsEdgeTestNeeded.No);
    let index = flags.isTranslucent ? SurfaceTechnique._kTranslucent : SurfaceTechnique._kOpaque;
    index += SurfaceTechnique._kInstanced * flags.isInstanced;
    index += SurfaceTechnique._kAnimated * flags.isAnimated;
    index += SurfaceTechnique._kShadowable * flags.isShadowable;
    index += SurfaceTechnique._kThematic * flags.isThematic;

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

  public constructor(gl: WebGLContext) {
    super(PolylineTechnique._kHilite + numHiliteVariants);

    this._earlyZFlags = [
      TechniqueFlags.fromDescription("Opaque-Hilite-Overrides"),
      TechniqueFlags.fromDescription("Opaque-Instanced-Hilite-Overrides"),
    ];

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createPolylineHiliter);
      for (const featureMode of featureModes) {
        flags.reset(featureMode, instanced, IsShadowable.No, IsThematic.No);
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
        flags.reset(featureMode, instanced, IsShadowable.No, IsThematic.No);
        this.addShader(builder, flags, gl);
      }
    }

    this.finishConstruction();
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

  public constructor(gl: WebGLContext, isSilhouette: boolean = false) {
    super(numFeatureVariants(EdgeTechnique._kFeature));
    this._isSilhouette = isSilhouette;

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      for (let iAnimate = IsAnimated.No; iAnimate <= IsAnimated.Yes; iAnimate++) {
        for (const featureMode of featureModes) {
          flags.reset(featureMode, instanced, IsShadowable.No, IsThematic.No);
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
          flags.reset(featureMode, instanced, IsShadowable.No, IsThematic.No);
          flags.isAnimated = iAnimate;
          this.addShader(builder, flags, gl);
        }
      }
    }

    this.finishConstruction();
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

  public constructor(gl: WebGLContext) {
    super((PointStringTechnique._kHilite + numHiliteVariants));

    const flags = scratchTechniqueFlags;
    for (let instanced = IsInstanced.No; instanced <= IsInstanced.Yes; instanced++) {
      this.addHiliteShader(gl, instanced, IsClassified.No, createPointStringHiliter);
      for (const featureMode of featureModes) {
        flags.reset(featureMode, instanced, IsShadowable.No, IsThematic.No);
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
        flags.reset(featureMode, instanced, IsShadowable.No, IsThematic.No);
        this.addShader(builder, flags, gl);
      }
    }

    this.finishConstruction();
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
  private static readonly _kHilite = 8;

  public constructor(gl: WebGLContext) {
    super(PointCloudTechnique._kHilite + 2);

    this._earlyZFlags = [
      TechniqueFlags.fromDescription("Opaque-Hilite-Overrides"),
      TechniqueFlags.fromDescription("Opaque-Hilite-Classified"),
    ];

    for (let iClassified = IsClassified.No; iClassified <= IsClassified.Yes; iClassified++) {
      this.addHiliteShader(gl, IsInstanced.No, iClassified, () => createPointCloudHiliter(iClassified));
      const flags = scratchTechniqueFlags;
      for (let thematic = IsThematic.No; thematic <= IsThematic.Yes; thematic++) {
        const pointCloudFeatureModes = [FeatureMode.None, FeatureMode.Overrides];
        for (const featureMode of pointCloudFeatureModes) {
          flags.reset(featureMode, IsInstanced.No, IsShadowable.No, thematic);
          flags.isClassified = iClassified;
          const builder = createPointCloudBuilder(flags.isClassified, featureMode, thematic);
          if (FeatureMode.Overrides === featureMode)
            addUniformFeatureSymbology(builder, true);

          this.addFeatureId(builder, featureMode);
          this.addShader(builder, flags, gl);
        }
      }
    }

    this.finishConstruction();
  }

  protected get _debugDescription() { return "PointCloud"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite)
      return PointCloudTechnique._kHilite + flags.isClassified;
    else {
      let ndx = 0;
      if (flags.isClassified)
        ndx++;
      if (flags.featureMode !== FeatureMode.None)
        ndx += 2;
      if (flags.isThematic)
        ndx += 4;
      return ndx;
    }
  }
}

class RealityMeshTechnique extends VariedTechnique {
  private static readonly _numVariants = 50;

  public constructor(gl: WebGLRenderingContext) {
    super(RealityMeshTechnique._numVariants);
    this._earlyZFlags = [
      TechniqueFlags.fromDescription("Opaque-Hilite-Overrides"),
      TechniqueFlags.fromDescription("Opaque-Hilite-Classified"),
    ];
    this.addHiliteShader(gl, IsInstanced.No, IsClassified.No, createRealityMeshHiliter);
    this.addHiliteShader(gl, IsInstanced.No, IsClassified.Yes, createClassifierRealityMeshHiliter);
    for (let iClassified = IsClassified.No; iClassified <= IsClassified.Yes; iClassified++) {
      for (let iTranslucent = 0; iTranslucent <= 1; iTranslucent++) {
        for (let shadowable = IsShadowable.No; shadowable <= IsShadowable.Yes; shadowable++) {
          for (let thematic = IsThematic.No; thematic <= IsThematic.Yes; thematic++) {
            const flags = scratchTechniqueFlags;
            for (const featureMode of featureModes) {
              flags.reset(featureMode, IsInstanced.No, shadowable, thematic);
              flags.isClassified = iClassified;
              flags.isTranslucent = 1 === iTranslucent;
              const builder = createRealityMeshBuilder(flags);

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
    }

    this.finishConstruction();
  }

  protected get _debugDescription() { return "RealityMesh"; }

  public computeShaderIndex(flags: TechniqueFlags): number {
    if (flags.isHilite)
      return flags.isClassified ? 1 : 0;
    let ndx = 2;
    if (flags.isClassified)
      ndx++;
    if (flags.isShadowable)
      ndx += 2;
    if (flags.isTranslucent)
      ndx += 4;
    ndx += 8 * flags.featureMode;
    if (flags.isThematic)
      ndx += 24;
    return ndx;
  }
}

interface PrioritizedShaderVariation {
  featureMode: FeatureMode;
  isInstanced: IsInstanced;
  isShadowable: IsShadowable;
  isEdgeTestedNeeded: IsEdgeTestNeeded;
  isTranslucent: boolean;
}

interface PrioritizedTechniqueOrShader {
  techniqueId: TechniqueId;
  specificShader?: PrioritizedShaderVariation; // if defined, only compile this specific shader variation for the technique; otherwise, compile all uncompiled shader variations for the technique
}

const techniquesByPriority: PrioritizedTechniqueOrShader[] = [
  // Compile these specific shader variations first because they seem most likely to be used immediately upon opening a file.
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.None, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, isTranslucent: false } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.None, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Pick, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.No, isTranslucent: true } },
  { techniqueId: TechniqueId.Surface, specificShader: { featureMode: FeatureMode.Overrides, isInstanced: IsInstanced.No, isShadowable: IsShadowable.No, isEdgeTestedNeeded: IsEdgeTestNeeded.Yes, isTranslucent: true } },

  // Next, compile all shaders in specific techniques.
  // Do surfaces first because (1) they are the most commonly used and (2) they take longer to compile.
  { techniqueId: TechniqueId.Surface },
  { techniqueId: TechniqueId.Edge },
  { techniqueId: TechniqueId.SilhouetteEdge },
  { techniqueId: TechniqueId.Polyline },
  { techniqueId: TechniqueId.PointString },
  { techniqueId: TechniqueId.PointCloud },
  { techniqueId: TechniqueId.RealityMesh },

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
  { techniqueId: TechniqueId.Combine3Textures },
  { techniqueId: TechniqueId.PlanarGrid },
];
const numTechniquesByPriority = techniquesByPriority.length;

/** A collection of rendering techniques accessed by ID.
 * @internal
 */
export class Techniques implements WebGLDisposable {
  private readonly _list = new Array<Technique>(); // indexed by TechniqueId, which may exceed TechniqueId.NumBuiltIn for dynamic techniques.
  private readonly _dynamicTechniqueIds = new Array<string>(); // technique ID = (index in this array) + TechniqueId.NumBuiltIn
  private _techniqueByPriorityIndex = 0;
  private _shaderIndex = 0;

  public static create(gl: WebGLContext): Techniques {
    const techs = new Techniques();
    techs.initializeBuiltIns(gl);
    return techs;
  }

  public getTechnique(id: TechniqueId): Technique {
    assert(id < this._list.length, "technique index out of bounds");
    return this._list[id];
  }

  public get numTechniques(): number {
    return this._list.length;
  }

  public addDynamicTechnique(technique: Technique, name: string): TechniqueId {
    const id = this.getDynamicTechniqueId(name);
    if (undefined !== id)
      return id;

    this._dynamicTechniqueIds.push(name);
    this._list.push(technique);
    return TechniqueId.NumBuiltIn + this._dynamicTechniqueIds.length - 1;
  }

  public getDynamicTechniqueId(name: string): TechniqueId | undefined {
    const index = this._dynamicTechniqueIds.indexOf(name);
    return -1 !== index ? index + TechniqueId.NumBuiltIn + index : undefined;
  }

  /** Execute each command in the list */
  public execute(target: Target, commands: DrawCommands, renderPass: RenderPass) {
    assert(RenderPass.None !== renderPass, "invalid render pass");

    using(new ShaderProgramExecutor(target, renderPass), (executor: ShaderProgramExecutor) => {
      for (const command of commands)
        command.execute(executor);
    });
    System.instance.frameBufferStack.markTargetsDirty();
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
    System.instance.frameBufferStack.markTargetsDirty();
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
      if (this._techniqueByPriorityIndex >= numTechniquesByPriority)
        return false;

      let shader: ShaderProgram;
      let numShaders = 0;

      const pTech = techniquesByPriority[this._techniqueByPriorityIndex];
      const tech = this._list[pTech.techniqueId];

      if (pTech.specificShader !== undefined) { // if this entry consists of a specific shader, just compile that
        const flags = scratchTechniqueFlags;
        flags.reset(pTech.specificShader.featureMode, pTech.specificShader.isInstanced, pTech.specificShader.isShadowable, IsThematic.No);
        flags.isEdgeTestNeeded = pTech.specificShader.isEdgeTestedNeeded;
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

  /** For tests. */
  public forEachVariedProgram(func: (program: ShaderProgram) => void): void {
    for (const technique of this._list)
      if (technique instanceof VariedTechnique)
        technique.forEachProgram(func);
  }

  private constructor() { }

  private initializeBuiltIns(gl: WebGLContext): void {
    this._list[TechniqueId.OITClearTranslucent] = new SingularTechnique(createClearTranslucentProgram(gl));
    this._list[TechniqueId.ClearPickAndColor] = new SingularTechnique(createClearPickAndColorProgram(gl));
    this._list[TechniqueId.CopyColor] = new SingularTechnique(createCopyColorProgram(gl));
    this._list[TechniqueId.CopyColorNoAlpha] = new SingularTechnique(createCopyColorProgram(gl, false));
    this._list[TechniqueId.CopyPickBuffers] = new SingularTechnique(createCopyPickBuffersProgram(gl));
    this._list[TechniqueId.EVSMFromDepth] = new SingularTechnique(createEVSMProgram(gl));
    this._list[TechniqueId.SkyBox] = new SingularTechnique(createSkyBoxProgram(gl));
    this._list[TechniqueId.SkySphereGradient] = new SingularTechnique(createSkySphereProgram(gl, true));
    this._list[TechniqueId.SkySphereTexture] = new SingularTechnique(createSkySphereProgram(gl, false));
    this._list[TechniqueId.AmbientOcclusion] = new SingularTechnique(createAmbientOcclusionProgram(gl));
    this._list[TechniqueId.Blur] = new SingularTechnique(createBlurProgram(gl));
    this._list[TechniqueId.CombineTextures] = new SingularTechnique(createCombineTexturesProgram(gl));
    this._list[TechniqueId.Combine3Textures] = new SingularTechnique(createCombine3TexturesProgram(gl));
    this._list[TechniqueId.Surface] = new SurfaceTechnique(gl);
    this._list[TechniqueId.Edge] = new EdgeTechnique(gl, false);
    this._list[TechniqueId.SilhouetteEdge] = new EdgeTechnique(gl, true);
    this._list[TechniqueId.Polyline] = new PolylineTechnique(gl);
    this._list[TechniqueId.PointString] = new PointStringTechnique(gl);
    this._list[TechniqueId.PointCloud] = new PointCloudTechnique(gl);
    this._list[TechniqueId.RealityMesh] = new RealityMeshTechnique(gl);
    this._list[TechniqueId.PlanarGrid] = new SingularTechnique(createPlanarGridProgram(gl));
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

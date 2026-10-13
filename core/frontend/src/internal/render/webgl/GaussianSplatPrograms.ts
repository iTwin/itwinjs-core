/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { dispose, expectDefined } from "@itwin/core-bentley";
import { RenderMemory } from "../../../render/RenderMemory";
import { BufferHandle, BufferParameters, BuffersContainer } from "./AttributeBuffers";
import { CachedGeometry, TexturedViewportQuadGeometry } from "./CachedGeometry";
import { DrawParams } from "./DrawCommand";
import { assignFragColor } from "./glsl/Fragment";
import { gaussianSplatFragment, gaussianSplatMaxSigmaCssPixels, gaussianSplatVertex } from "./glsl/GaussianSplats";
import { GaussianSplatColorSpace, gaussianSplatTileMetadata } from "./GaussianSplatVisibleTiles";
import { gaussianSplatPageTableWidth } from "../GaussianSplatInstances";
import { createViewportQuadBuilder } from "./glsl/ViewportQuad";
import { GL } from "./GL";
import { Pass, RenderOrder, TextureUnit } from "./RenderFlags";
import { FragmentShaderComponent, VariableType } from "./ShaderBuilder";
import { ShaderProgram } from "./ShaderProgram";
import { System } from "./System";
import { Target } from "./Target";
import { SingularTechnique, Techniques } from "./Technique";
import { TechniqueId } from "./TechniqueId";
import { Texture2DArrayHandle, Texture2DHandle } from "./Texture";
import { UniformHandle } from "./UniformHandle";

/** Texture units of the splat program's samplers. */
const gaussianSplatTextureUnit = {
  splats: TextureUnit.Zero,
  tiles: TextureUnit.One,
  planes: TextureUnit.Two,
  auxiliary: TextureUnit.Four,
  pages: TextureUnit.Five,
} as const;

/** A data texture of RGBA32F (or RGBA32UI) rows that are rewritten every frame. It is reallocated only when a frame needs more
 * rows than it has, to twice as many, so that most frames only update the rows they use.
 * @internal
 */
export class GaussianSplatRowTexture implements Disposable {
  private _texture?: Texture2DHandle;

  /** @param _width Texels per row. */
  public constructor(private readonly _width: number) { }

  public get texture(): Texture2DHandle | undefined { return this._texture; }
  public get bytesUsed(): number { return this._texture?.bytesUsed ?? 0; }

  /** Upload the first `rows` rows of `values`, `width` texels of 4 components per row. */
  public upload(values: Float32Array | Uint32Array, rows: number): void {
    const height = this._texture?.height ?? 0;
    if (rows > height)
      this.reallocate(values, Math.max(rows, Math.min(2 * height, System.instance.maxTextureSize)));

    this._texture?.replaceTextureData(values, rows);
  }

  private reallocate(values: Float32Array | Uint32Array, height: number): void {
    this._texture = dispose(this._texture);
    const integer = values instanceof Uint32Array;
    const texels = integer ? new Uint32Array(this._width * height * 4) : new Float32Array(this._width * height * 4);
    const format = integer ? GL.Texture.Format.RgbaInteger : GL.Texture.Format.Rgba;
    this._texture = Texture2DHandle.createForData(this._width, height, texels, false, GL.Texture.WrapMode.ClampToEdge, format);
    if (!this._texture)
      throw new Error("Gaussian splats: failed to allocate a data texture");
  }

  public [Symbol.dispose](): void {
    this._texture = dispose(this._texture);
  }
}

/** The GPU inputs of one viewport's splat draw, which the splat technique's uniforms read: the sorted order (one uint32 logical
 * slot per instance, in a vertex array of its own), the frame's tile metadata, clip plane and page table textures, the shared
 * atlas arrays, and the trained color space to draw.
 * @internal
 */
export class GaussianSplatDrawGeometry extends CachedGeometry {
  private readonly _instances = new BufferHandle(GL.Buffer.Target.ArrayBuffer);
  private readonly _buffers = BuffersContainer.create();
  /** One row per drawn tile occurrence (see gaussianSplatTileMetadata). */
  public readonly metadata = new GaussianSplatRowTexture(gaussianSplatTileMetadata.length / 4);
  /** One clip plane per row. */
  public readonly planes = new GaussianSplatRowTexture(1);
  /** See buildGaussianSplatPageTable. */
  public readonly pageTable = new GaussianSplatRowTexture(gaussianSplatPageTableWidth);
  public splats?: WebGLTexture;
  public auxiliary?: WebGLTexture;
  public instanceCount = 0;
  /** Splats trained in another color space are not drawn. */
  public colorSpace = GaussianSplatColorSpace.Display;
  public readonly qOrigin = new Float32Array(3);
  public readonly qScale = new Float32Array([1, 1, 1]);

  public constructor() {
    super();
    // The shader reads each instance's logical slot as an unsigned integer.
    const slot = BufferParameters.create(0, 1, GL.DataType.UnsignedInt, false, 4, 0, true, true);
    this._buffers.addBuffer(this._instances, [slot]);
  }

  /** Replace the instances with the sorted order's logical slots. */
  public uploadInstances(slots: Uint32Array): void {
    this._instances.bindData(slots, GL.Buffer.Usage.DynamicDraw);
  }

  public get techniqueId(): TechniqueId { return gaussianSplatTechniques(System.instance.techniques).splats; }
  public get isDisposed(): boolean { return this._buffers.isDisposed; }
  public get renderOrder(): RenderOrder { return RenderOrder.UnlitSurface; }
  public getPass(): Pass { return "gaussian-splats"; }
  protected _wantWoWReversal(_target: Target): boolean { return false; }

  /** Draw one camera-facing quad per instance. */
  public draw(): void {
    const gl = System.instance.context;
    this._buffers.bind();
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount);
    this._buffers.unbind();
  }

  /** The instance buffer is counted by [[GaussianSplatDrawPass]], which knows the size it uploaded. */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addTexture(this.metadata.bytesUsed + this.planes.bytesUsed + this.pageTable.bytesUsed);
  }

  public [Symbol.dispose](): void {
    dispose(this._buffers);
    dispose(this._instances);
    for (const rows of [this.metadata, this.planes, this.pageTable])
      rows[Symbol.dispose]();
  }
}

/** A full-screen pass of the linear color field (see GaussianSplatDrawPass): fill the field from `texture` (the frame), or
 * composite `texture` (the field) onto the frame. @internal
 */
export class GaussianSplatColorFieldGeometry extends TexturedViewportQuadGeometry {
  public static createColorField(texture: WebGLTexture, techniqueId: TechniqueId): GaussianSplatColorFieldGeometry | undefined {
    return this.createTexturedViewportQuadGeometry(techniqueId, [texture]) as GaussianSplatColorFieldGeometry | undefined;
  }

  public get texture(): WebGLTexture { return this._textures[0]; }
  public set texture(texture: WebGLTexture) { this._textures[0] = texture; }
}

function drawGeometry(params: DrawParams): GaussianSplatDrawGeometry {
  return params.geometry as GaussianSplatDrawGeometry;
}

/** Every row texture has been uploaded before the splats are drawn. */
function bindRowSampler(uniform: UniformHandle, rows: GaussianSplatRowTexture, unit: TextureUnit): void {
  expectDefined(rows.texture).bindSampler(uniform, unit);
}

function createSplatProgram(gl: WebGL2RenderingContext): ShaderProgram {
  const useLogZ = System.instance.supportsLogZBuffer;
  const program = new ShaderProgram(gl, gaussianSplatVertex(useLogZ), gaussianSplatFragment(), undefined, "//!V! GaussianSplats", "//!F! GaussianSplats");
  program.addProgramUniform("u_proj", (uniform, params) => params.bindProjectionMatrix(uniform));
  program.addProgramUniform("u_viewport", (uniform, params) => params.target.uniforms.viewRect.bindDimensions(uniform));
  program.addProgramUniform("u_frustum", (uniform, params) => uniform.setUniform3fv(params.target.uniforms.frustum.frustum));
  program.addProgramUniform("u_maxSigma", (uniform, params) => uniform.setUniform1f(gaussianSplatMaxSigmaCssPixels * params.target.devicePixelRatio));
  if (useLogZ)
    program.addProgramUniform("u_logZ", (uniform, params) => uniform.setUniform2fv(params.target.uniforms.frustum.logZ));

  const unit = gaussianSplatTextureUnit;
  program.addGraphicUniform("u_space", (uniform, params) => uniform.setUniform1i(drawGeometry(params).colorSpace));
  program.addGraphicUniform("u_pages", (uniform, params) => bindRowSampler(uniform, drawGeometry(params).pageTable, unit.pages));
  program.addGraphicUniform("u_tiles", (uniform, params) => bindRowSampler(uniform, drawGeometry(params).metadata, unit.tiles));
  program.addGraphicUniform("s_clipSampler", (uniform, params) => bindRowSampler(uniform, drawGeometry(params).planes, unit.planes));
  program.addGraphicUniform("u_splats", (uniform, params) => Texture2DArrayHandle.bindSampler(uniform, drawGeometry(params).splats, unit.splats));
  program.addGraphicUniform("u_auxiliary", (uniform, params) => Texture2DArrayHandle.bindSampler(uniform, drawGeometry(params).auxiliary, unit.auxiliary));
  return program;
}

const linearFromDisplay = `
vec3 linearFromDisplay(vec3 color) {
  return mix(color / 12.92, pow((max(color, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), greaterThan(color, vec3(0.04045)));
}
`;

const displayFromLinear = `
vec3 displayFromLinear(vec3 color) {
  return mix(12.92 * color, 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, greaterThan(color, vec3(0.0031308)));
}
`;

/** The frame's color in linear space, with no coverage. */
const computeFillColor = "return vec4(linearFromDisplay(TEXTURE(u_color, v_texCoord).rgb), 0.0);";

/** The field's clamped color in display space, with its coverage; pixels without coverage are discarded. */
const computeCompositeColor = `
  vec4 field = TEXTURE(u_color, v_texCoord);
  return vec4(displayFromLinear(clamp(field.rgb, vec3(0.0), vec3(1.0))), field.a);
`;

function createColorFieldProgram(gl: WebGL2RenderingContext, composite: boolean): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;
  frag.addFunction(composite ? displayFromLinear : linearFromDisplay);
  frag.set(FragmentShaderComponent.ComputeBaseColor, composite ? computeCompositeColor : computeFillColor);
  if (composite)
    frag.set(FragmentShaderComponent.CheckForDiscard, "return 0.0 == baseColor.a;");

  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  frag.addUniform("u_color", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_color", (uniform, params) => {
      Texture2DHandle.bindSampler(uniform, (params.geometry as GaussianSplatColorFieldGeometry).texture, TextureUnit.Zero);
    });
  });

  builder.setDebugDescription(composite ? "GaussianSplatComposite" : "GaussianSplatFill");
  return builder.buildProgram(gl);
}

/** The IDs of the splat techniques in a render system's techniques. @internal */
export interface GaussianSplatTechniqueIds {
  /** Draws the sorted splats. */
  splats: TechniqueId;
  /** Fills the linear color field from the frame. */
  fill: TechniqueId;
  /** Composites the linear color field onto the frame. */
  composite: TechniqueId;
}

/** The ID of the dynamic technique `name`, registered with a program from `createProgram` the first time it is asked for. */
function dynamicTechniqueId(techniques: Techniques, name: string, createProgram: (gl: WebGL2RenderingContext) => ShaderProgram): TechniqueId {
  return techniques.getDynamicTechniqueId(name) ?? techniques.addDynamicTechnique(new SingularTechnique(createProgram(System.instance.context)), name);
}

/** The splat techniques of `techniques`. They are dynamic techniques, created on first use, so that applications that do not
 * draw splats compile no splat shaders; like every technique, their programs are compiled on first use or by
 * Techniques.compileShaders, and disposed with the render system.
 * @internal
 */
export function gaussianSplatTechniques(techniques: Techniques): GaussianSplatTechniqueIds {
  return {
    splats: dynamicTechniqueId(techniques, "GaussianSplats", createSplatProgram),
    fill: dynamicTechniqueId(techniques, "GaussianSplatFill", (gl) => createColorFieldProgram(gl, false)),
    composite: dynamicTechniqueId(techniques, "GaussianSplatComposite", (gl) => createColorFieldProgram(gl, true)),
  };
}

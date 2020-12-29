/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Viewport } from "../Viewport";

/** The underlying data types that can be used for uniform variables in screen-space effect shaders.
 * @see [[ScreenSpaceEffectBuilder.addUniform]] to define a uniform variable.
 * @see [[Uniform]] to set the value of a uniform variable.
 * @beta
 */
export enum UniformType {
  /** GLSL `bool`. */
  Bool,
  /** GLSL `int`. */
  Int,
  /** GLSL `float`. */
  Float,
  /** GLSL `vec2`. */
  Vec2,
  /** GLSL `vec3`. */
  Vec3,
  /** GLSL `vec4`. */
  Vec4,
}

/** The underlying data types that can be used for varying variables in screen-space effect shaders.
 * @see [[ScreenSpaceEffectBuilder.addVarying]] to define a varying variable.
 * @beta
 */
export enum VaryingType {
  /** GLSL `float`. */
  Float,
  /** GLSL `vec2`. */
  Vec2,
  /** GLSL `vec3`. */
  Vec3,
  /** GLSL `vec4`. */
  Vec4,
}

/** Represents a uniform variable in a shader program used by a custom screen-space effect, providing methods for setting the current value of the uniform.
 * @see [[UniformParams.bind]].
 * @see [[ScreenSpaceEffectBuilder.addUniform]].
 * @beta
 */
export interface Uniform {
  /** Sets the value to an integer - equivalent to `WebGLRenderingContext.uniform1i`. */
  setUniform1i: (value: number) => void;
  /** Sets the value to a float - equivalent to `WebGLRenderingContext.uniform1f`. */
  setUniform1f: (value: number) => void;
  /** Sets the value to an array of floats - equivalent to `WebGLRenderingContext.uniform1fv`. */
  setUniform1fv: (value: Float32Array | number[]) => void;
  /** Sets the value as a vec2, equivalent to `WebGLRenderingContext.uniform2fv`. */
  setUniform2fv: (value: Float32Array | number[]) => void;
  /** Sets the value as a vec3 - equivalent to `WebGLRenderingContext.uniform3fv`. */
  setUniform3fv: (value: Float32Array | number[]) => void;
  /** Sets the value as a vec4 - equivalent to `WebGLRenderingContext.uniform4fv`. */
  setUniform4fv: (value: Float32Array | number[]) => void;
}

/** Context supplied to [[UniformParams.bind]].
 * @beta
 */
export interface UniformContext {
  /** The viewport to which the screen-space effect is to be applied. */
  viewport: Viewport;
}

/** Parameters used to define a uniform variable for a [[ScreenSpaceEffectBuilder]]'s shader program.
 * @see [[ScreenSpaceEffectBuilder.addUniform]].
 * @beta.
 */
export interface UniformParams {
  /** The data type of the uniform variable. */
  type: UniformType;
  /** The name of the variable. It must be unique among all uniforms used by the shader program. */
  name: string;
  /** A function that computes the value of the variable and binds it to the shader program. */
  bind: (uniform: Uniform, context: UniformContext) => void;
}

/** Parameters used to create a [[ScreenSpaceEffectBuilder]].
 * @see [[RenderSystem.createScreenSpaceEffectBuilder]].
 * @beta
 */
export interface ScreenSpaceEffectBuilderParams {
  /** The name of the effect. Must be unique among all registered screen-space effects. */
  name: string;

  /** The GLSL implementation of the effect, to be integrated into a complete shader program. The effect shader code differs slightly from that of an ordinary shader:
   *  - Instead of `main`, it should implement `effectMain`.
   *  - It should omit declarations of uniform and varying variables - these will be generated from those supplied to [[ScreenSpaceEffectBuilder.addUniform]] and [[ScreenSpaceEffectBuilder.addVarying]].
   * The program receives one pre-defined `uniform sampler2D u_diffuse` representing the viewport's rendered image.
   * Because the [[RenderSystem]] uses either WebGL1 or WebGL2 based on the capabilities of the client, the effect shader should be written to compile with either; or, [[ScreenSpaceEffectBuilder.isWebGL2]] should be tested.
   * The [[RenderSystem]] takes care of adjusting the source code for some of these differences, e.g., `varying` (WebGL1) vs `in` and `out` (WebGL2);
   * and `TEXTURE`, `TEXTURE_CUBE`, and `TEXTURE_PROJ` macros to replace `texture2D`, `textureCube`, and `texture2DProj` with their WebGL2 equivalents when applicable.
   */
  source: {
    /** The GLSL implementation of the vertex shader. Instead of `main`, it implements `void effectMain(vec4 position)` where `position` is the vertex position in normalized device coordinates ([-1..1]).
     * `effectMain` should compute whatever information is required by the fragment shader. It should not assign to `gl_Position`.
     */
    vertex: string;

    /** The GLSL implementation of the fragment shader. Instead of `main`, it implements `vec4 effectMain()` returning the color to be output.
     * `effectMain` should sample `u_diffuse` using `TEXTURE()` or `TEXTURE_PROJ()` instead of `texture2D()`, `texture2DProj()`, or `texture()`.
     * It should not assign to `gl_FragColor`.
     * The alpha component of the output color is ignored as there is nothing with which to blend.
     */
    fragment: string;
  };

  /** If true, adds a `vec2 textureCoordFromPosition(vec4 position)` function to the vertex shader that computes a UV coordinate based on the vertex's position. */
  textureCoordFromPosition?: boolean;
}

/** Context passed to [[ScreenSpaceEffectBuilder.shouldApply]].
 * @beta
 */
export interface ScreenSpaceEffectContext {
  /** The viewport to which the screen-space effect is to be applied. */
  viewport: Viewport;
}

/** An interface used to construct and register with the [[IModelApp.renderSystem]] a custom screen-space effect.
 * Screen-space effects take as input the image rendered by a Viewport, as a WebGL texture, and execute a shader program to modify the image.
 * Any number of screen-space effects can be registered; they are processed in the order in which they were registered.
 * Each frame, the [[RenderSystem]] does the following:
 *  - Render the scene to a texture.
 *  - For each registered screen-space effect, in the order in which they were registered:
 *    - If `shouldApply` is undefined, or returns true, apply the effect
 * @note A screen-space effect that **moves** pixels (e.g., lens distortion) rather than simply recoloring them may cause element locate to behave unexpectedly -
 * elements will be located based on their original locations, unaffected by the screen-space effect.
 * @see [[RenderSystem.createScreenSpaceEffectBuilder]].
 * @see [[ScreenSpaceEffectBuilderParams]] to define the initial state of the builder.
 * @beta
 */
export interface ScreenSpaceEffectBuilder {
  /** True if the shader will be used with a WebGL 2 rendering context. */
  readonly isWebGL2: boolean;

  /** Add a uniform variable to the shader program. */
  addUniform: (params: UniformParams) => void;

  /** Add a varying variable to the shader program. */
  addVarying: (name: string, type: VaryingType) => void;

  /** If defined, a function invoked each frame before the effect is applied. If it returns false, the effect will be skipped for that frame. */
  shouldApply?: (context: ScreenSpaceEffectContext) => boolean;

  /** Finishes construction of the effect and, if successful, registers it with [[IModelApp.renderSystem]].
   * @throws Error if the shader fails to compile and link, or an effect with the same name has already been registered.
   * @note After `finish` is called, no other properties or methods of the builder will have any effect.
   */
  finish: () => void;
}

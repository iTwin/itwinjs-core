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
  /** GLSL `float`. */
  Float,
  /** GLSL `float[]`. */
  FloatArray,
  /** GLSL `vec2`. */
  Vec2,
  /** GLSL `vec3`. */
  Vec3,
  /** GLSL `vec4`. */
  Vec4,
  /** GLSL `int`. */
  Int,
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
  /** The partial GLSL source code for the vertex shader. The code will differ slightly from that of an ordinary vertex shader:
   *  - The code does not need to assign to `gl_Position` - this will be handled automatically.
   *  - Instead of `main()`, the code should implement `void effectMain(vec4 position)` to compute whatever varyings need to be sent to the fragment shader.
   *    - ###TODO define what `position` is and clarify that the shader does not need to manually compute gl_Position.
   *  - The code should omit uniform variable declarations - these will be generated from the uniforms supplied to [[ScreenSpaceEffectBuilder.addUniform]].
   */
  vertexShader: string;
  /** The partial GLSL source code for the fragment shader. The code will differ slightly from that of an ordinary fragment shader:
   *  - The code should not assign to `gl_FragColor`.
   *  - Instead of `main()`, the code should implement `vec4 effectMain()` returning the color to be output.
   *  - The code should omit uniform variable declarations - these will be generated from the uniforms supplied to [[ScreenSpaceEffectBuilder.addUniform]].
   */
  fragmentShader: string;
}

/** Context passed to [[ScreenSpaceEffectBuilder.shouldApply]].
 * @beta
 */
export interface ScreenSpaceEffectContext {
  /** The viewport to which the screen-space effect is to be applied. */
  viewport: Viewport;
}

/** An interface used to construct and register with the [[IModelApp.renderSystem]] a custom screen-space effect.
 * Screen-space effects take as input the image rendered by a Viewport, as a WebGL texture.
 * They execute a shader program to modify the image.
 * Any number of screen-space effects can be registered; they are processed in the order in which they were registered.
 * Each frame, the [[RenderSystem]] does the following:
 *  - Render the scene to a texture.
 *  - For each registered screen-space effect, in the order in which they were registered:
 *    - If `shouldApply` is undefined, or returns true, apply the effect
 * @note Screen-space effects are typically registered after [[IModelApp.startup]] has completed.
 * @see [[RenderSystem.createScreenSpaceEffectBuilder]].
 * @beta
 */
export interface ScreenSpaceEffectBuilder {
  /** Add a uniform variable to the shader program.
   * @throws Error if a uniform with the same name already exists.
   */
  addUniform: (params: UniformParams) => void;
  /** If defined, a function invoked each frame before the effect is applied. If it returns false, the effect will be skipped for that frame. */
  shouldApply?: (context: ScreenSpaceEffectContext) => boolean;
  /** Finishes construction of the effect and, if successful, registers it with [[IModelApp.renderSystem]].
   * @throws Error if the shader failed to compile, `finish` has already been called, or an effect with the same name has already been registered.
   * @note After `finish` is called, no other properties or methods of the builder will have any effect.
   */
  finish: () => void;
}

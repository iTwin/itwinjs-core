/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { AttributeMap } from "../AttributeMap";
import { SkyBoxQuadsGeometry } from "../CachedGeometry";
import { Matrix3 } from "../Matrix";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture } from "../Texture";

const computeBaseColor = `return vec4(0, 0, 0, 0);`;
const assignFragData = `FragColor = TEXTURE_CUBE(s_cube, v_texDir);`;
const computePosition = `vec3 pos = u_rot * vec3(rawPos.x, rawPos.z, -rawPos.y); return pos.xyzz;`; // rawPos swizzling accounts for iModel rotation.
const computeTexDir = `v_texDir = rawPosition.xyz;`;

const scratchRotMatrix = new Matrix3();

/** @internal */
export function createSkyBoxProgram(context: WebGLContext): ShaderProgram {
  const prog = new ProgramBuilder(AttributeMap.findAttributeMap(undefined, false));

  prog.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  prog.frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  prog.vert.set(VertexShaderComponent.ComputePosition, computePosition);
  prog.vert.addUniform("u_rot", VariableType.Mat3, (prg) => {
    prg.addGraphicUniform("u_rot", (uniform, params) => {
      const rot = params.target.uniforms.frustum.viewMatrix.matrix;
      const mat3 = scratchRotMatrix;
      mat3.m00 = -rot.at(0, 0); mat3.m01 = -rot.at(0, 1); mat3.m02 = -rot.at(0, 2);
      mat3.m10 = -rot.at(1, 0); mat3.m11 = -rot.at(1, 1); mat3.m12 = -rot.at(1, 2);
      mat3.m20 = rot.at(2, 0); mat3.m21 = rot.at(2, 1); mat3.m22 = rot.at(2, 2);
      uniform.setMatrix3(mat3);
    });
  });

  prog.frag.addUniform("s_cube", VariableType.SamplerCube, (prg) => {
    prg.addGraphicUniform("s_cube", (uniform, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      (geom.cube as Texture).texture.bindSampler(uniform, TextureUnit.Zero);
    });
  });
  prog.addInlineComputedVarying("v_texDir", VariableType.Vec3, computeTexDir);

  prog.vert.headerComment = "//!V! SkyBox";
  prog.frag.headerComment = "//!F! SkyBox";

  return prog.buildProgram(context);
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderComponent, ProgramBuilder, VertexShaderComponent, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { TextureUnit } from "../RenderFlags";
import { Texture } from "../Texture";
import { Matrix3 } from "../Matrix";
import { SkyBoxQuadsGeometry } from "../CachedGeometry";

const computeBaseColor = `return vec4(0, 0, 0, 0);`;
const assignFragData = `FragColor = TEXTURE_CUBE(s_cube, v_texDir);`;
const computePosition = `vec3 pos = u_rot * vec3(rawPos.x, rawPos.z, -rawPos.y); return pos.xyzz;`; // rawPos swizzling accounts for iModel rotation.
const computeTexDir = `v_texDir = rawPosition.xyz;`;

export function createSkyBoxProgram(context: WebGLRenderingContext): ShaderProgram {
  const prog = new ProgramBuilder(false);

  prog.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  prog.frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  prog.vert.set(VertexShaderComponent.ComputePosition, computePosition);
  prog.vert.addUniform("u_rot", VariableType.Mat3, (prg) => {
    prg.addGraphicUniform("u_rot", (uniform, params) => {
      const rot = params.viewMatrix.getRotation();
      const mat3 = new Matrix3();
      mat3.m00 = -rot.m00; mat3.m01 = -rot.m01; mat3.m02 = -rot.m02;
      mat3.m10 = -rot.m10; mat3.m11 = -rot.m11; mat3.m12 = -rot.m12;
      mat3.m20 = rot.m20; mat3.m21 = rot.m21; mat3.m22 = rot.m22;
      uniform.setMatrix3(mat3);
    });
  });

  prog.frag.addUniform("s_cube", VariableType.SamplerCube, (prg) => {
    prg.addGraphicUniform("s_cube", (uniform, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      (geom.cube! as Texture).texture.bindSampler(uniform, TextureUnit.Zero);
    });
  });
  prog.addInlineComputedVarying("v_texDir", VariableType.Vec3, computeTexDir);

  return prog.buildProgram(context);
}

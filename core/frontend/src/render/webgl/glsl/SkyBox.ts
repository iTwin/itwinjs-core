/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderComponent, ProgramBuilder, VertexShaderComponent, VariableType, VertexShaderBuilder } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { TextureUnit } from "../RenderFlags";
import { Texture } from "../Texture";
import { Matrix3 } from "../Matrix";
import { SkyBoxQuadsGeometry } from "../CachedGeometry";

const computeBaseColor = `return vec4(0, 0, 0, 0);`;
const assignFragData = `
if (v_side < 0.2 - 0.001) FragColor = TEXTURE(s_front, v_texCoord);
else if (v_side < 0.4 - 0.001) FragColor = TEXTURE(s_back, v_texCoord);
else if (v_side < 0.6 - 0.001) FragColor = TEXTURE(s_top, v_texCoord);
else if (v_side < 0.8 - 0.001) FragColor = TEXTURE(s_bottom, v_texCoord);
else if (v_side < 1.0 - 0.001) FragColor = TEXTURE(s_left, v_texCoord);
else // if (1.0 == v_side)
  FragColor = TEXTURE(s_right, v_texCoord);
`;

const computePosition = `vec3 pos = u_rot * rawPos.xyz; return pos.xyzz;`;
const computeTexCoord = `v_texCoord = a_texCoord;`;
const computeSide = `v_side = a_side;`;

function addSkyBoxSide(vert: VertexShaderBuilder) {
  vert.addAttribute("a_side", VariableType.Float, (prog) => {
    prog.addAttribute("a_side", (attr, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      geom.bindSideArray(attr);
    });
  });
}

function addTexCoord(vert: VertexShaderBuilder) {
  vert.addAttribute("a_texCoord", VariableType.Vec2, (prog) => {
    prog.addAttribute("a_texCoord", (attr, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      geom.bindTexCoordArray(attr);
    });
  });
}

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
      // mat3.initIdentity(); // ###TODO: remove.  This is for testing only.
      uniform.setMatrix3(mat3);
    });
  });
  addSkyBoxSide(prog.vert);
  addTexCoord(prog.vert);

  prog.frag.addUniform("s_front", VariableType.Sampler2D, (prg) => {
    prg.addGraphicUniform("s_front", (uniform, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      (geom.front as Texture).texture.bindSampler(uniform, TextureUnit.Zero);
    });
  });
  prog.frag.addUniform("s_back", VariableType.Sampler2D, (prg) => {
    prg.addGraphicUniform("s_back", (uniform, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      (geom.back as Texture).texture.bindSampler(uniform, TextureUnit.One);
    });
  });
  prog.frag.addUniform("s_top", VariableType.Sampler2D, (prg) => {
    prg.addGraphicUniform("s_top", (uniform, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      (geom.top as Texture).texture.bindSampler(uniform, TextureUnit.Two);
    });
  });
  prog.frag.addUniform("s_bottom", VariableType.Sampler2D, (prg) => {
    prg.addGraphicUniform("s_bottom", (uniform, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      (geom.bottom as Texture).texture.bindSampler(uniform, TextureUnit.Three);
    });
  });
  prog.frag.addUniform("s_left", VariableType.Sampler2D, (prg) => {
    prg.addGraphicUniform("s_left", (uniform, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      (geom.left as Texture).texture.bindSampler(uniform, TextureUnit.Four);
    });
  });
  prog.frag.addUniform("s_right", VariableType.Sampler2D, (prg) => {
    prg.addGraphicUniform("s_right", (uniform, params) => {
      const geom = params.geometry as SkyBoxQuadsGeometry;
      (geom.right as Texture).texture.bindSampler(uniform, TextureUnit.Five);
    });
  });

  prog.addInlineComputedVarying("v_texCoord", VariableType.Vec2, computeTexCoord);
  prog.addInlineComputedVarying("v_side", VariableType.Float, computeSide);

  return prog.buildProgram(context);
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "../../../../../bentley/lib/bentleyjs-core";
import { VariableType, FragmentShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { GLSLFragment } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { FrustumUniformType, fromSumOf } from "../Target";
import { Frustum, Npc } from "../../../../../common/lib/common";
import { Vector3d, Point3d, Constant } from "../../../../../geometry/lib/geometry-core";
import { SkySphereViewportQuadGeometry } from "../CachedGeometry";
import { GL } from "../GL";

const computeSphericalUV = `
  vec3 eyeToVert = a_worldPos - u_worldEye;
  float zOffset = 0.0;
  float rotation = 0.0;
  float radius = sqrt(eyeToVert.x * eyeToVert.x + eyeToVert.y * eyeToVert.y);
  float zValue = eyeToVert.z - radius * zOffset;
  float azimuth = (atan(eyeToVert.y, eyeToVert.x) + rotation) / 6.28318530718;
  float altitude = atan(zValue, radius);
  return vec2(0.5 - altitude / 3.14159265359, 0.25 - azimuth);
`;

const computeSkySphereColor = `
  if (u_skyParams.x < -0.1) {
    // 2-color sky gradient
    return vec4(mix(u_zenithColor, u_nadirColor, v_gradientUV.x), 1.0);
  } else if (u_skyParams.x > 0.1) {
    // 4-color sky gradient
    float d = (0.5 - v_gradientUV.x) * 2.0; // d ranges from 1 to -1 instead of 0 to 1
    float middle = 0.0015;
    if (d > middle) // fuzz up the horizon a little
      return vec4(mix(u_zenithColor, u_skyColor, pow(1.0 - (d - middle) / (1.0 - middle), u_skyParams.y)), 1.0);
    else if (d < -middle)
      return vec4(mix(u_nadirColor, u_groundColor, pow(1.0 - (-d - middle) / (1.0 - middle), u_skyParams.z)), 1.0);
    else
      return vec4(mix(u_groundColor, u_skyColor, (d + middle) / (middle * 2.0)), 1.0);
  } else {
    // ###TODO: use single/spherical texture
  }
`;

const scratch3Floats = new Float32Array(3);
const scratchVec3 = new Vector3d();
const scratchPoint3 = new Point3d();

function setPointsFromFrustum(skyGeometry: SkySphereViewportQuadGeometry, frustum: Frustum) {
  const wp = skyGeometry.worldPos;
  let mid = frustum.getCorner(Npc.LeftBottomRear).interpolate(0.5, frustum.getCorner(Npc.LeftBottomFront), scratchPoint3);
  wp[0] = mid.x;
  wp[1] = mid.y;
  wp[2] = mid.z;
  mid = frustum.getCorner(Npc.RightBottomRear).interpolate(0.5, frustum.getCorner(Npc.RightBottomFront), scratchPoint3);
  wp[3] = mid.x;
  wp[4] = mid.y;
  wp[5] = mid.z;
  mid = frustum.getCorner(Npc.RightTopRear).interpolate(0.5, frustum.getCorner(Npc.RightTopFront), scratchPoint3);
  wp[6] = mid.x;
  wp[7] = mid.y;
  wp[8] = mid.z;
  mid = frustum.getCorner(Npc.LeftTopRear).interpolate(0.5, frustum.getCorner(Npc.LeftTopFront), scratchPoint3);
  wp[9] = mid.x;
  wp[10] = mid.y;
  wp[11] = mid.z;
}

export function createSkySphereProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(false);
  builder.addFunctionComputedVarying("v_gradientUV", VariableType.Vec2, "computeSphericalUV", computeSphericalUV);

  const vert = builder.vert;
  vert.addUniform("u_worldEye", VariableType.Vec3, (shader) => {
    shader.addGraphicUniform("u_worldEye", (uniform, params) => {
      const frustum = params.target.planFrustum;
      if (FrustumUniformType.Perspective === params.target.frustumUniforms.type) {
        // compute eye point from frustum.
        const farLowerLeft = frustum.getCorner(Npc.LeftBottomRear);
        const nearLowerLeft = frustum.getCorner(Npc.LeftBottomFront);
        const scale = 1.0 / (1.0 - params.target.planFraction);
        const zVec = Vector3d.createStartEnd(farLowerLeft, nearLowerLeft, scratchVec3);
        const cameraPosition = fromSumOf(farLowerLeft, zVec, scale, scratchPoint3);
        scratch3Floats[0] = cameraPosition.x;
        scratch3Floats[1] = cameraPosition.y;
        scratch3Floats[2] = cameraPosition.z;
        uniform.setUniform3fv(scratch3Floats);
      } else {
        const delta = Vector3d.createStartEnd(frustum.getCorner(Npc.LeftBottomRear), frustum.getCorner(Npc.LeftBottomFront));
        const pseudoCameraHalfAngle = 22.5;
        const diagonal = frustum.getCorner(Npc.LeftBottomRear).distance(frustum.getCorner(Npc.RightTopRear));
        const focalLength = diagonal / (2 * Math.atan(pseudoCameraHalfAngle * Constant.radiansPerDegree));
        const worldEye = Point3d.add3Scaled(frustum.getCorner(Npc.LeftBottomRear), .5, frustum.getCorner(Npc.RightTopRear), .5, delta, focalLength / delta.magnitude());
        scratch3Floats[0] = worldEye.x;
        scratch3Floats[1] = worldEye.y;
        scratch3Floats[2] = worldEye.z;
        uniform.setUniform3fv(scratch3Floats);
      }
    });
  });
  vert.addAttribute("a_worldPos", VariableType.Vec3, (shaderProg) => {
    shaderProg.addAttribute("a_worldPos", (attr, params) => {
      // Send in the corners of the view in world space.
      const geom = params.geometry;
      assert(geom instanceof SkySphereViewportQuadGeometry);
      const skyGeometry = geom as SkySphereViewportQuadGeometry;
      setPointsFromFrustum(skyGeometry, params.target.planFrustum);
      skyGeometry.bind();
      attr.enableArray(skyGeometry.worldPosBuff, 3, GL.DataType.Float, false, 0, 0);
    });
  });

  const frag = builder.frag;
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeSkySphereColor);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  frag.addUniform("u_zenithColor", VariableType.Vec3, (shader) => {
    shader.addGraphicUniform("u_zenithColor", (uniform, params) => {
      const geom = params.geometry as SkySphereViewportQuadGeometry;
      uniform.setUniform3fv(geom.zenithColor);
    });
  });
  frag.addUniform("u_skyColor", VariableType.Vec3, (shader) => {
    shader.addGraphicUniform("u_skyColor", (uniform, params) => {
      const geom = params.geometry as SkySphereViewportQuadGeometry;
      uniform.setUniform3fv(geom.skyColor);
    });
  });
  frag.addUniform("u_groundColor", VariableType.Vec3, (shader) => {
    shader.addGraphicUniform("u_groundColor", (uniform, params) => {
      const geom = params.geometry as SkySphereViewportQuadGeometry;
      uniform.setUniform3fv(geom.groundColor);
    });
  });
  frag.addUniform("u_nadirColor", VariableType.Vec3, (shader) => {
    shader.addGraphicUniform("u_nadirColor", (uniform, params) => {
      const geom = params.geometry as SkySphereViewportQuadGeometry;
      uniform.setUniform3fv(geom.nadirColor);
    });
  });
  frag.addUniform("u_skyParams", VariableType.Vec3, (shader) => {
    shader.addGraphicUniform("u_skyParams", (uniform, params) => {
      const geom = params.geometry as SkySphereViewportQuadGeometry;
      uniform.setUniform3fv(geom.typeAndExponents);
    });
  });

  builder.vert.headerComment = "// ----- SkySphere -----";
  builder.frag.headerComment = "// ----- SkySphere -----";

  return builder.buildProgram(context);
}

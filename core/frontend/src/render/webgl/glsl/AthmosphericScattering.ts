/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  FragmentShaderComponent,
  ProgramBuilder,
  VariablePrecision,
  VariableType,
  VertexShaderComponent,
} from "../ShaderBuilder";
import { WebGLContext } from "@itwin/webgl-compatibility";
import { ShaderProgram } from "../ShaderProgram";
import { AttributeMap } from "../AttributeMap";
import { AtmosphericScatteringViewportQuadGeometry } from "../CachedGeometry";
import { MAX_SAMPLE_POINTS, MESH_PROJECTION_CUTOFF_HEIGHT } from "../AtmosphericScatteringUniforms";

// #region GENERAL

const computeRayDirDefault = `
vec3 computeRayDir() {
  return normalize(v_eyeSpace);
}
`;

const computeSceneDepthDefault = `
  float computeSceneDepth(vec3 rayDirection) {
    return length(v_eyeSpace);
  }
`;

const computeSceneDepthSky = `
float computeSceneDepth(vec3 rayDirection) {
  return MAX_FLOAT;
}
`;

// #endregion GENERAL

// #region ELLIPSOID

/**
 * Computes the intersection of a ray with an ellipsoid and returns two values:
 * 1. The length from the ray's origin to the point it first intersects with the ellipsoid.
 * 2. The length from the first point the ray intersects with the sphere to the second point it intersects with the ellipsoid.
 *
 * @param ellipsoidCenter - Center of the ellipsoid in view coordinates.
 * @param inverseRotationMatrix - Transformation matrix to invert the ecdb to world and world to eye rotations.
 * @param ellipsoidScaleMatrix - Diagonal matrix where the diagonal represents the x, y and z radii of the ellipsoid.
 * @param inverseEllipsoidScaleMatrix - Transpose (also inverse) of the ellipsoidScaleMatrix.
 * @param rayOrigin - The starting point of the ray in eye space.
 * @param rayDir - The direction of the ray.
 * @returns A vec2 of float values representing the ray's distance to and through the ellipsoid.
 */
const rayEllipsoidIntersectionGeneric = `
vec2 rayEllipsoidIntersection(vec3 ellipsoidCenter, mat3 inverseRotationMatrix, mat3 ellipsoidScaleMatrix, mat3 inverseEllipsoidScaleMatrix, vec3 rayOrigin, vec3 rayDir) {
  vec3 ro, rd;

  // transform ray to be relative to sphere
  rd = inverseRotationMatrix * rayDir;
  ro = inverseRotationMatrix * (rayOrigin - ellipsoidCenter); // uniform for rayOrigin - ellipsoidCenter

  vec3 rdi = normalize(inverseEllipsoidScaleMatrix * rd);
  vec3 roi = inverseEllipsoidScaleMatrix * ro;

  vec2 toAndThrough = raySphere(vec3(0.0), 1.0, roi, rdi);
  if (toAndThrough[1] > 0.0) {
    vec3 pt = roi + rdi * toAndThrough[0];
    return vec2(
      distance(ro, ellipsoidScaleMatrix * pt),
      distance(ellipsoidScaleMatrix * pt, ellipsoidScaleMatrix * (pt + rdi * toAndThrough[1]))
    );
  }
  return toAndThrough;
}
`;

/**
 * Computes the intersection of a ray originating from the eye space origin (0.0, 0.0, 0.0) with the atmosphere ellipsoid:
 * 1. The length from the ray's origin to the point it first intersects with the ellipsoid.
 * 2. The length from the first point the ray intersects with the sphere to the second point it intersects with the ellipsoid.
 *
 * @param rayDir - The direction of the ray.
 * @returns A vec2 of float values representing the ray's distance to and through the ellipsoid.
 */
const eyeAtmosphereIntersection = `
vec2 eyeAtmosphereIntersection(vec3 rayDir) {
  return _eyeEllipsoidIntersection(
    rayDir, u_atmosphereToEyeInverseScaled, u_atmosphereScaleMatrix,
    u_inverseRotationInverseAtmosphereScaleMatrix
  );
}
`;

/**
 * Computes the intersection of a ray originating from the eye space origin (0.0, 0.0, 0.0) with the earth ellipsoid:
 * 1. The length from the ray's origin to the point it first intersects with the ellipsoid.
 * 2. The length from the first point the ray intersects with the sphere to the second point it intersects with the ellipsoid.
 *
 * @param rayDir - The direction of the ray.
 * @returns A vec2 of float values representing the ray's distance to and through the ellipsoid.
 */
const eyeEarthIntersection = `
vec2 eyeEarthIntersection(vec3 rayDir) {
  return _eyeEllipsoidIntersection(
    rayDir, u_earthToEyeInverseScaled, u_earthScaleMatrix,
    u_inverseRotationInverseEarthScaleMatrix
  );
}
`;

const _eyeEllipsoidIntersection = `
vec2 _eyeEllipsoidIntersection(vec3 rayDir, vec3 rayOriginToUnitSphere, mat3 ellipsoidScaleMatrix, mat3 inverseEllipsoidRotationAndScaleMatrix) {
  // transform ray to be relative to sphere
  vec3 rayDirToEllipsoid = normalize(inverseEllipsoidRotationAndScaleMatrix * rayDir);

  vec2 toAndThrough = raySphere(vec3(0.0), 1.0, rayOriginToUnitSphere, rayDirToEllipsoid);
  if (toAndThrough[1] > 0.0) {
    vec3 point = rayDirToEllipsoid * toAndThrough[0] + rayOriginToUnitSphere;
    vec3 scaledPoint = ellipsoidScaleMatrix * point;
    return vec2(
      distance(u_ellipsoidToEye, scaledPoint),
      distance(scaledPoint, ellipsoidScaleMatrix * (rayDirToEllipsoid * toAndThrough[1] + point))
    );
  }
  return toAndThrough;
}
`;

/**
 * Computes the intersection of a ray with a sphere and returns two values:
 * 1. The length from the ray's origin to the point it first intersects with the sphere.
 * 2. The length from the first point the ray intersects with the sphere to the second point it intersects with the sphere.
 *
 * @param sphereCenter - The center point of the sphere in eye space.
 * @param sphereRadius - The radius of the sphere.
 * @param rayOrigin - The starting point of the ray in eye space.
 * @param rayDir - The direction of the ray.
 * @returns A vec2 of float values representing the ray's distance to and through the sphere.
 */
const raySphere = `
vec2 raySphere(vec3 sphereCenter, float sphereRadius, vec3 rayOrigin, vec3 rayDir) {
  vec3 offset = rayOrigin - sphereCenter;
  float a = 1.0;
  float b = 2.0 * dot(offset, rayDir);
  float c = dot(offset, offset) - sphereRadius * sphereRadius;
  float d = b * b - 4.0 * a * c;
  if (d > 0.0) {
    float s = sqrt(d);
    float distanceToSphereNear = max(0.0, (-b - s) / (2.0 * a));
    float distanceToSphereFar = (-b + s) / (2.0 * a);
    if (distanceToSphereFar >= 0.0) {
      return vec2(distanceToSphereNear, distanceToSphereFar - distanceToSphereNear);
    }
  }
  return vec2(MAX_FLOAT, 0.0);
}
`;

/**
 * Returns the optical depth of a ray going through the atmosphere,
 * taking into account atmosphere density.
 *
 * @param rayOrigin - The starting point in eye space of the ray we calculate optical depth from.
 * @param rayDir - The direction of the ray.
 * @param rayLength - The length of the ray.
 * @returns A float in the range [0.0, rayLength] representing optical depth.
 */
const opticalDepth = `
float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength) {
  vec3 densitySamplePoint = rayOrigin;
  float stepSize = rayLength / (float(u_numOpticalDepthPoints) - 1.0);
  float opticalDepth = 0.0;
  vec3 rayStep = rayDir * stepSize;

  for (int i = 0; i < u_numOpticalDepthPoints; i ++) {
    float localDensity = densityAtPoint(densitySamplePoint);
    opticalDepth += localDensity;
    densitySamplePoint += rayStep;
  }
  return opticalDepth  * stepSize;
}
`;

/**
 * Returns the atmospheric density at a point according to its distance between
 * a minimum and maximum density height. Density decreases exponentially,
 * modulated by a density falloff coefficient.
 *
 * We find out at what ratio between the minimum density ellipsoid and the
 * maximum density ellipsoid (the atmosphere's limit) by squeezing the
 * coordinate space by the minimum density ellipsoid's scale factors, taking
 * the ellipsoid rotation into account. Then, we find out
 *
 * @param point - Point we want to sample density for.
 * @returns A density value between [0.0 - 1.0].
 */
const densityAtPoint = `
float densityAtPoint(vec3 point) {
  vec3 pointToMinDensityUnitSphere = u_inverseRotationInverseMinDensityScaleMatrix * (point - u_earthCenter);
  float atmosphereDistanceFromUnitSphere = u_minDensityToAtmosphereScaleFactor - 1.0;
  float distanceNotZero = atmosphereDistanceFromUnitSphere == 0.0 ? 0.0 : 1.0;
  float minToMaxRatio = distanceNotZero * (max(length(pointToMinDensityUnitSphere) - 1.0, 0.0) / atmosphereDistanceFromUnitSphere);
  return exp(-minToMaxRatio * u_densityFalloff) * (1.0 - minToMaxRatio);
}
`;

const calculateScattering = `
vec3 calculateScattering(vec3 rayOrigin, vec3 rayDir, float rayLength, vec3 baseColor) {
  float stepSize = rayLength / (float(u_numInScatteringPoints) - 1.0);
  vec3 step = rayDir * stepSize;
  vec3 inScatteredLight;
  float viewRayOpticalDepth;
  vec3 inScatterPoint = rayOrigin;

  float viewRayOpticalDepthValues[MAX_SAMPLE_POINTS];
  vec3 viewRaySamplePoint = rayOrigin + step;
  for (int i = 1; i < u_numInScatteringPoints; i++) {
    viewRayOpticalDepthValues[i-1] = densityAtPoint(viewRaySamplePoint) * stepSize;
    viewRaySamplePoint += step;
  }

  for (int i = 0; i < u_numInScatteringPoints; i++) {
    float sunRayLength = rayEllipsoidIntersection(u_earthCenter, u_inverseEllipsoidRotationMatrix, u_atmosphereScaleMatrix, u_inverseAtmosphereScaleMatrix, inScatterPoint, u_sunDir)[1];
    float sunRayOpticalDepth = opticalDepth(inScatterPoint, u_sunDir, sunRayLength);
    viewRayOpticalDepth = 0.0;
    for (int j = 0; j < i; j++) {
      viewRayOpticalDepth += viewRayOpticalDepthValues[j];
    }
    vec3 transmittance = exp(-((sunRayOpticalDepth + viewRayOpticalDepth) / u_earthScaleMatrix[2][2]) * u_scatteringCoefficients);

    inScatteredLight += densityAtPoint(inScatterPoint) * transmittance;
    inScatterPoint += step;
  }
  inScatteredLight *= u_scatteringCoefficients * u_inScatteringIntensity * stepSize / u_earthScaleMatrix[2][2];
  // float originalColorTransmittance = exp(-viewRayOpticalDepth / u_earthScaleMatrix[2][2] * u_outScatteringIntensity);

  // float brightnessAdaptionStrength = 0.15;
  float reflectedLightOutScatterStrength = 3.0;
  float brightnessAdaption = (inScatteredLight.r + inScatteredLight.g + inScatteredLight.b) * u_brightnessAdaptionStrength;
  float brightnessSum = viewRayOpticalDepth / u_earthScaleMatrix[2][2] * u_outScatteringIntensity * reflectedLightOutScatterStrength + brightnessAdaption;
  float reflectedLightStrength = exp(-brightnessSum);
  float hdrStrength = clamp((baseColor.r + baseColor.g + baseColor.b) / 3.0 - 1.0, 0.0, 1.0);
  reflectedLightStrength = mix(reflectedLightStrength, 1.0, hdrStrength);
  vec3 reflectedLight = baseColor * reflectedLightStrength;


  // return vec3(reflectedLightStrength);
  return reflectedLight + inScatteredLight;
}
`;

/**
 *   // We get the distance the ray traveled from the eye to the atmosphere and
  // the distance it traveled in the atmosphere to reach the fragment.
 *
 */
const applyAtmosphericScatteringEllipsoid = `
vec4 applyAtmosphericScatteringEllipsoid(vec3 rayDir, float sceneDepth, vec4 baseColor) {
  vec2 atmosphereHitInfo = eyeAtmosphereIntersection(rayDir);
  vec2 earthHitInfo = eyeEarthIntersection(rayDir);
  float distanceThroughAtmosphere = min(
    atmosphereHitInfo[1],
    min(sceneDepth, earthHitInfo[0]) - atmosphereHitInfo[0] // PREVENTS GRID EFFECT
  );
  float distanceThroughEarth = min(earthHitInfo[1], sceneDepth - earthHitInfo[0]);

  if (distanceThroughAtmosphere - distanceThroughEarth > 0.0) {
    vec3 pointInAtmosphere = rayDir * (atmosphereHitInfo[0] + EPSILON);
    vec3 scatteredColor = calculateScattering(pointInAtmosphere, rayDir, distanceThroughAtmosphere - EPSILONx2, baseColor.rgb);
    return vec4(scatteredColor, baseColor.a);
  }
  return baseColor;
}
`;
// #endregion ELLIPSOID

// #region MAIN
const applyAtmosphericScattering = `
  // return baseColor if atmospheric scattering is disabled
  if (!bool(u_isEnabled))
    return baseColor;

  vec3 rayDir = computeRayDir();
  float sceneDepth = computeSceneDepth(rayDir);

  return applyAtmosphericScatteringEllipsoid(rayDir, sceneDepth, baseColor);
`;

/** @internal */
export function addAtmosphericScatteringEffect(
  builder: ProgramBuilder,
  isSky = false,
) {
  const frag = builder.frag;
  frag.addConstant("PI", VariableType.Float, "3.14159265359");
  frag.addConstant("EPSILON", VariableType.Float, "0.000001");
  frag.addConstant("EPSILONx2", VariableType.Float, "EPSILON * 2.0");
  frag.addConstant("MAX_FLOAT", VariableType.Float, "3.402823466e+38");
  frag.addConstant("MAX_SAMPLE_POINTS", VariableType.Int, `${MAX_SAMPLE_POINTS}`);
  frag.addConstant("MESH_PROJECTION_CUTOFF_HEIGHT", VariableType.Float, `${MESH_PROJECTION_CUTOFF_HEIGHT}.0`);

  frag.addUniform(
    "u_earthScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_earthScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindEarthScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_densityFalloff",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_densityFalloff", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindDensityFalloff(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_scatteringCoefficients",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_scatteringCoefficients", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindScatteringCoefficients(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_numInScatteringPoints",
    VariableType.Int,
    (prog) => {
      prog.addProgramUniform("u_numInScatteringPoints", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindNumInScatteringPoints(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_numOpticalDepthPoints",
    VariableType.Int,
    (prog) => {
      prog.addProgramUniform("u_numOpticalDepthPoints", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindNumOpticalDepthPoints(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_sunDir",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_sunDir", (uniform, params) => {
        params.target.uniforms.bindSunDirection(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_earthCenter",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_earthCenter", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindEarthCenter(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_isEnabled",
    VariableType.Int,
    (prog) => {
      prog.addProgramUniform("u_isEnabled", (uniform, params) => {
        uniform.setUniform1i(
          params.target.plan.viewFlags.atmosphericScattering ? 1 : 0
        );
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_inverseEllipsoidRotationMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseEllipsoidRotationMatrix", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindInverseEllipsoidRotationMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_ellipsoidToEye",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_ellipsoidToEye", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindEllipsoidToEye(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_atmosphereScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_atmosphereScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_inverseAtmosphereScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseAtmosphereScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindInverseAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_atmosphereToEyeInverseScaled",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_atmosphereToEyeInverseScaled", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindAtmosphereToEyeInverseScaled(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_minDensityToAtmosphereScaleFactor",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_minDensityToAtmosphereScaleFactor", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindMinDensityToAtmosphereScaleFactor(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_inScatteringIntensity",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_inScatteringIntensity", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindInScatteringIntensity(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_outScatteringIntensity",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_outScatteringIntensity", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindOutScatteringIntensity(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_earthToEyeInverseScaled",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_earthToEyeInverseScaled", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindEarthToEyeInverseScaled(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_earthScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_earthScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindEarthScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_inverseRotationInverseAtmosphereScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseRotationInverseAtmosphereScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindInverseRotationInverseAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_inverseRotationInverseEarthScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseRotationInverseEarthScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindInverseRotationInverseEarthScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_inverseRotationInverseMinDensityScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseRotationInverseMinDensityScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindInverseRotationInverseMinDensityScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  frag.addUniform(
    "u_brightnessAdaptionStrength",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_brightnessAdaptionStrength", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindBrightnessAdaptationStrength(uniform);
      });
    },
    VariablePrecision.High
  );

  frag.addFunction(raySphere);
  frag.addFunction(_eyeEllipsoidIntersection);
  frag.addFunction(densityAtPoint);

  frag.addFunction(rayEllipsoidIntersectionGeneric);
  frag.addFunction(eyeAtmosphereIntersection);
  frag.addFunction(eyeEarthIntersection);

  frag.addFunction(opticalDepth);

  frag.addFunction(calculateScattering);

  frag.addFunction(applyAtmosphericScatteringEllipsoid);

  frag.addFunction(computeRayDirDefault);
  if (isSky) {
    frag.addFunction(computeSceneDepthSky);
  } else {
    frag.addFunction(computeSceneDepthDefault);
  }

  frag.set(
    FragmentShaderComponent.ApplyAtmosphericScattering,
    applyAtmosphericScattering
  );
}
// #endregion MAIN

// #region QUAD
const computeBaseColorVS = `return vec4(u_skyColor.xyz, 1.0);`;
const computeBaseColorFS = `return v_color;`;
const assignFragData = `FragColor = baseColor;`;
const computePosition = `
vec3 pos01 = rawPos.xyz * 0.5 + 0.5;

float top = u_frustumPlanes.x;
float bottom = u_frustumPlanes.y;
float left = u_frustumPlanes.z;
float right = u_frustumPlanes.w;

v_eyeSpace = vec3(
  mix(left, right, pos01.x),
  mix(bottom, top, pos01.y),
  -u_frustum.x
);
// v_eyeSpace.x = rawPos.x == -1.0 ? 0.0 : 1.0;
// v_eyeSpace.y = rawPos.y == -1.0 ? 0.0 : 1.0;
// v_eyeSpace = pos01;

// return vec4(pos01.x, pos01.y, rawPos.z, rawPos.z);
return rawPos;
`;

/** @internal */
export function createAtmosphericSkyProgram(
  context: WebGLContext
): ShaderProgram {
  const prog = new ProgramBuilder(
    AttributeMap.findAttributeMap(undefined, false)
  );

  prog.frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  prog.vert.set(VertexShaderComponent.ComputePosition, computePosition);
  prog.vert.set(VertexShaderComponent.ComputeBaseColor, computeBaseColorVS);
  prog.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColorFS);
  prog.vert.addUniform("u_frustumPlanes", VariableType.Vec4, (prg) => {
    prg.addGraphicUniform("u_frustumPlanes", (uniform, params) => {
      uniform.setUniform4fv(params.target.uniforms.frustum.planes); // { top, bottom, left, right }
    });
  });
  prog.vert.addUniform("u_frustum", VariableType.Vec3, (prg) => {
    prg.addGraphicUniform("u_frustum", (uniform, params) => {
      uniform.setUniform3fv(params.target.uniforms.frustum.frustum); // { near, far, type }
    });
  });
  prog.addVarying("v_eyeSpace", VariableType.Vec3);
  prog.vert.addUniform("u_skyColor", VariableType.Vec3, (shader) => {
    shader.addGraphicUniform("u_skyColor", (uniform, params) => {
      const geom = params.geometry as AtmosphericScatteringViewportQuadGeometry;
      uniform.setUniform3fv(geom.atmosphericSkyColor);
    });
  });
  prog.addVarying("v_color", VariableType.Vec4);
  // prog.vert.addUniform("u_vpSize", VariableType.Vec2, (prg) => {
  //   prg.addProgramUniform("u_vpSize", (uniform, params) => {
  //     params.target.uniforms.viewRect.bindDimensions(uniform);
  //   });
  // }, VariablePrecision.High);

  // prog.frag.addUniform("s_cube", VariableType.SamplerCube, (prg) => {
  //   prg.addGraphicUniform("s_cube", (uniform, params) => {
  //     const geom = params.geometry as AtmosphericScatteringViewportQuadGeometry;
  //     (geom.cube as Texture).texture.bindSampler(uniform, TextureUnit.Zero);
  //   });
  // });
  // prog.addInlineComputedVarying("v_texDir", VariableType.Vec3, computeTexDir);

  addAtmosphericScatteringEffect(prog, true);

  prog.vert.headerComment = "//!V! AtmosphericSky";
  prog.frag.headerComment = "//!F! AtmosphericSky";

  return prog.buildProgram(context);
}
// #endregion QUAD

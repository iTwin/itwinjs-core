/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  FragmentShaderBuilder,
  FragmentShaderComponent,
  ProgramBuilder,
  VariablePrecision,
  VariableType,
  VertexShaderBuilder,
} from "../ShaderBuilder";
import { MAX_SAMPLE_POINTS } from "../AtmosphereUniforms";

/** A physics-based atmospheric scattering technique that simulates how an atmosphere diverts light.
 * @internal
 * This shader adds an atmospheric scattering effect that mimics some aspects of the physical phenomenons of Rayleigh Scattering and Mie Scattering.
 *
 * This implementation is highly inspired by Sebastian Lague's Solar System project: https://github.com/SebLague/Solar-System/ and video: https://www.youtube.com/watch?v=DxfEbulyFcY
 * along with this ShaderToy replica: https://www.shadertoy.com/view/fltXD2.
 * Both of which are inspired by this Nvidia article on atmospheric scattering: https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering.
 *
 * The effect traces rays from the vertices or fragments toward the eye/camera and samples air density at multiple points to compute how much light is scattered away by the air molecules.
 * It also traces rays from the aforementioned sample points toward the sun and samples air density at multiple points to compute how much light is scattered in toward the eye/camera.
 *
 * The effect can be computed on vertices (the default for the background map) and fragments (the default for the skybox, which is a ViewportQuad).
 * The effect is much more accurate when computed on fragments, as the atmosphere is an ellipsoid. Air density between 2 vertices cannot be linearly interpolated.
 *
 * All coordinates are in view space.
 */

// #region GENERAL

const computeRayDir = `
vec3 computeRayDir(vec3 eyeSpace) {
  return u_isCameraEnabled ? normalize(eyeSpace) : vec3(0.0, 0.0, -1.0);
}
`;

const computeSceneDepthDefault = `
float computeSceneDepth(vec3 eyeSpace) {
  return u_isCameraEnabled ? length(eyeSpace) : -eyeSpace.z;
}
`;

// TODO: ask about default scene depth potentially being insufficient
// const computeSceneDepthSky = `
// float computeSceneDepth(vec3 eyeSpace) {
//   return MAX_FLOAT;
// }
// `;

const computeRayOrigin = `
vec3 computeRayOrigin(vec3 eyeSpace) {
  return u_isCameraEnabled ? vec3(0.0) : vec3(eyeSpace.xy, 0.0);
}
`;

// #endregion GENERAL

// #region ELLIPSOID

/**
 * Computes the intersection of a ray with a sphere and returns two values:
 * 1. The length from the ray's origin to the point where it first intersects with the sphere.
 * 2. The length from the first point where the ray intersects with the sphere, to the second point where it intersects with the sphere.
 *
 * @param sphereCenter - The center point of the sphere in eye space.
 * @param sphereRadius - The radius of the sphere.
 * @param rayOrigin - The starting point of the ray in eye space.
 * @param rayDir - The direction of the ray.
 * @returns A vec2 of float values representing the ray's distance to and through the sphere.
 */
const raySphere = `
 vec2 raySphere(vec3 sphereCenter, float sphereRadius, vec3 rayOrigin, vec3 rayDir) {
   // Adapted from: https://math.stackexchange.com/questions/1939423/calculate-if-vector-intersects-sphere
   // 1. For a given unit vector U and arbitrary point P, the equation for a line which shares direction with U and intersects with P is given as: f(x) = P + xU
   // 2. For a given sphere with center C and radius R, and arbitrary point Q, Q lies on the sphere if the length of (Q - C) equals the radius. This can be expressed as: ||Q - C||^2 = R^2
   // 3. By the definition of the dot product: ||Q - C||^2 = (Q - C) • (Q - C)
   // 4. If we constrain arbitrary point Q to the line described in (1.), our new sphere equation is: (P - C + xU) • (P - C + xU) = R^2
   // 5. Because dot product is distributive, we can FOIL the binomials and produce the following quadratic function: x^2(U • U) + 2x((P - C) • U) + (P - C) • (P - C) - R^2 = 0

   // Solving the quadratic formula
   float a = 1.0; // the dot product of a unit vector and itself equals 1
   vec3 offset = rayOrigin - sphereCenter; // We assign P in the formula above to the ray origin
   float b = 2.0 * dot(offset, rayDir);
   float c = dot(offset, offset) - sphereRadius * sphereRadius;
   float discriminant = b * b - 4.0 * a * c;

   // If the quadratic discriminant == 0, then there is only one (double) root, and if it is < 0, there are only complex roots; neither of these cases is useful to us here.
   // If it is > 0, there are two roots, denoting the intersections where the ray enters the sphere, and where it exits the sphere.
   if (discriminant <= 0.0) {
     return vec2(MAX_FLOAT, 0.0);
   }

   float s = sqrt(discriminant);
   float firstRoot = (-b - s) / (2.0 * a);
   float secondRoot = (-b + s) / (2.0 * a);
   if (firstRoot <= 0.0 && secondRoot <= 0.0) { // both intersections are behind the ray origin
     return vec2(MAX_FLOAT, 0.0);
   }
   float distanceToSphereNear = max(0.0, firstRoot); // If this root is negative and the other isn't, the ray origin must be inside the sphere, so the distance traveled to enter the sphere is 0
   float distanceToSphereFar = secondRoot;
   return vec2(distanceToSphereNear, distanceToSphereFar - distanceToSphereNear);
 }
 `;

/**
 * Computes the intersection of a ray with an ellipsoid and returns two values:
 * 1. The length from the ray's origin to the point where it first intersects with the ellipsoid.
 * 2. The length from the first point where the ray intersects with the ellipsoid, to the second point where it intersects with the ellipsoid.
 *
 * First, the coordinates (rayOrigin, rayDir) are transformed such that the ellipsoid is axis-aligned and at (0, 0, 0).
 * Then, the coordinate space is scaled down by the ellipsoidScaleMatrix such that it becomes a unit sphere.
 * Finally, intersection with the unit sphere is computed and coordinates transformed back to their original scale to return the desired lengths.
 *
 * @param ellipsoidCenter - Center of the ellipsoid in view coordinates.
 * @param rayOrigin - The starting point of the ray in view coordinates.
 * @param rayDir - The direction of the ray in view space.
 * @param inverseRotationMatrix - Rotation matrix inverting the ecdb to world and world to eye rotations.
 * @param inverseScaleInverseRotationMatrix - Transformation matrix that corresponds to the inverse of the ellipsoidScaleMatrix multiplied by the inverseRotationMatrix.
 * @param ellipsoidScaleMatrix - Diagonal matrix where the diagonal represents the x, y and z radii of the ellipsoid.
 *
 * @returns A vec2 of float values representing the ray's distance to and through the ellipsoid.
 */
const rayEllipsoidIntersection = `
vec2 rayEllipsoidIntersection(
  vec3 ellipsoidCenter,
  vec3 rayOrigin,
  vec3 rayDir,
  mat3 inverseScaleInverseRotationMatrix,
  mat3 ellipsoidScaleMatrix
) {
  vec3 rayOriginFromEllipsoid = rayOrigin - ellipsoidCenter;
  vec3 rayOriginFromAxisAlignedUnitSphere = inverseScaleInverseRotationMatrix * rayOriginFromEllipsoid;
  vec3 rayDirFromAxisAlignedUnitSphere = normalize(inverseScaleInverseRotationMatrix * rayDir);

  vec2 intersectionInfo = raySphere(vec3(0.0), 1.0, rayOriginFromAxisAlignedUnitSphere, rayDirFromAxisAlignedUnitSphere);

  // To map the intersection measurements from unit coordinates back to those of the ellipsoid, we scale both the distance to and through the unit sphere by the scale matrix.
  float distanceToEllipsoidNear = length(ellipsoidScaleMatrix * rayDirFromAxisAlignedUnitSphere * intersectionInfo[0]);
  float distanceThroughEllipsoid = length(ellipsoidScaleMatrix * rayDirFromAxisAlignedUnitSphere * intersectionInfo[1]);
  return vec2(distanceToEllipsoidNear, distanceThroughEllipsoid);
}
`;

/**
 * Returns the atmospheric density at a point according to its distance between
 * the maximum and minimum density thresholds. Density decreases exponentially,
 * modulated by a density falloff coefficient.
 *
 * We find out at what ratio between the maximum density ellipsoid and the
 * minimum density ellipsoid (the atmosphere's limit) by squeezing the
 * coordinate space by the maximum density ellipsoid's scale factors, taking
 * the ellipsoid rotation into account.
 *
 * @param point - Point we want to sample density for.
 * @returns A density value between [0.0 - 1.0].
 */
const densityAtPoint = `
float densityAtPoint(vec3 point) {
  vec3 pointFromEarthCenter = u_inverseRotationInverseMinDensityScaleMatrix * (point - u_earthCenter);

  // TODO: allow max density threshold to be specified instead of assuming it's equal to the earth's size (1.0)
  if (length(pointFromEarthCenter) <= 1.0) { // point is below the max density threshold
    return 1.0;
  }
  else if (length(pointFromEarthCenter) >= u_atmosphereRadiusScaleFactor) { // point is above the min density threshold
    return 0.0;
  }

  float atmosphereDistanceFromMaxDensityThreshold = u_atmosphereRadiusScaleFactor - 1.0;
  float samplePointDistanceFromMaxDensityThreshold = length(pointFromEarthCenter) - 1.0;
  float heightFrom0to1 = samplePointDistanceFromMaxDensityThreshold / atmosphereDistanceFromMaxDensityThreshold;
  float result = exp(-heightFrom0to1 * u_densityFalloff) * (1.0 - heightFrom0to1);

  return result;
}
`;

/**
 * Returns the optical depth of a ray going through the atmosphere, taking into account atmosphere density, by approximation via the trapezoid rule.
 *
 * @param rayOrigin - The starting point in eye space of the ray we calculate optical depth from.
 * @param rayDir - The direction of the ray.
 * @param rayLength - The length of the ray.
 * @param numSamplePoints - The number of points at which density is sampled to determine optical depth.
 * @returns A float in the range [0.0, rayLength] representing optical depth.
 */
const opticalDepth = `
float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength, int numSamplePoints) {
  if (numSamplePoints <= 1) {
    return densityAtPoint(rayOrigin) * rayLength;
  }

  int numPartitions = numSamplePoints - 1;
  float stepSize = rayLength / float(numPartitions);
  vec3 samplePointA = rayOrigin;
  vec3 samplePointB = rayOrigin + rayDir * stepSize;
  float previousSampleADensity = densityAtPoint(rayOrigin);
  float trapezoidRuleSum = 0.0;

  // To approximate the atmospheric density over the ray, we utilize the trapezoid rule, taking 2 density samples at each step, and averaging them before multiplying by the step size.
  // For performance benefit, we divide by 2 and multiply by stepSize after all steps are summed instead of every loop.
  for (int i = 1; i <= numPartitions; i++) {
    float sampleADensity = previousSampleADensity;
    float sampleBDensity = densityAtPoint(samplePointB);

    trapezoidRuleSum += sampleADensity + sampleBDensity;
    previousSampleADensity = sampleBDensity;
    samplePointB += rayDir * stepSize;
  }

  float opticalDepth = trapezoidRuleSum * stepSize / 2.0;
  return opticalDepth;
}
`;

/**
 * Calculates the atmospheric interference of light from both the sun and a given original color.
 */
const computeAtmosphericScatteringFromScratch = `
vec3 computeAtmosphericScattering(boolean ignoreRaycastsIntersectingEarth) {
  vec3 rayDir = computeRayDir(v_eyeSpace);
  vec3 rayOrigin = computeRayOrigin(v_eyeSpace);
  float sceneDepth = computeSceneDepth(v_eyeSpace);
  float diameterOfEarthAtEquator = u_earthScaleMatrix[2][2];

  vec2 earthHitInfo = rayEllipsoidIntersection(u_earthCenter, rayOrigin, rayDir, u_inverseEarthScaleInverseRotationMatrix, u_earthScaleMatrix);
  vec2 atmosphereHitInfo = rayEllipsoidIntersection(u_earthCenter, rayOrigin, rayDir, u_inverseAtmosphereScaleInverseRotationMatrix, u_atmosphereScaleMatrix);

  float distanceThroughAtmosphere = min(
    atmosphereHitInfo[1],
    min(sceneDepth, earthHitInfo[0] - atmosphereHitInfo[0])
  );

  if (distanceThroughAtmosphere <= 0.0) {
    return vec3(0.0);
  }

  // Before light reaches the camera, it must first travel from the sun through the atmosphere, where it is scattered in various directions through atmospheric interference.
  // The particular formulas describing exactly how the light is scattered involve integral calculus, but we can approximate their solutions through riemann sums.
  // These sums are computed by sampling atmospheric density at discrete points along the path the light is assumed to travel towards the camera.

  // This path consists of two parts: The path from camera to sample point, and from sample point to sun.
  // For each sample point chosen, we determine "how much" atmosphere exists between the point and the camera by calculating the average atmospheric density along the path,
  //   multiplied by the length of the ray (otherwise known as optical depth). Because we normalize density values between 0 and 1, the optical depth is, at most, equal to the ray length.
  // Likewise, we also calculate the optical depth between the sample point and sun. Together, these values represent the total optical depth of the path light takes through the sample point to the camera.

  // Because each sample point has a different orientation to the sun, the optical depth for all of them must be calculated separately.
  // However, because scatter points are initially selected along a shared ray originating from the camera, we are able to memoize the optical depth values between related points.

  int numPartitions = u_numInScatteringPoints - 1; // TODO: require 2 points or account for only 1 sample
  float stepSize = distanceThroughAtmosphere / float(numPartitions);
  vec3 step = rayDir * stepSize;
  vec3 firstPointInAtmosphere = rayDir * atmosphereHitInfo[0] + rayOrigin;
  vec3 scatterPoint = firstPointInAtmosphere;

  float opticalDepthFromRayOriginToSamplePoints[MAX_SAMPLE_POINTS];
  // The first sample point either lies at the edge of the atmosphere (camera is in space) or exactly at the ray origin (camera is in the atmosphere).
  // In both cases, the distance traveled through the atmosphere to this point is 0.
  opticalDepthFromRayOriginToSamplePoints[0] = 0.0;
  float amountOfLightScatteredAway = 0.0;

  for (int i = 1; i <= numPartitions; i++) {
    opticalDepthFromRayOriginToSamplePoints[i] = opticalDepth(scatterPoint, rayDir, -stepSize, 2) + opticalDepthFromRayOriginToSamplePoints[i-1];

    vec2 sunRayEarthHitInfo = rayEllipsoidIntersection(u_earthCenter, scatterPoint, u_sunDir, u_inverseEarthScaleInverseRotationMatrix, u_earthScaleMatrix);
    bool sunBlockedByEarth = sunRayEarthHitInfo[1] > 0.0;
    if (!sunBlockedByEarth) {
      vec2 sunRayAtmosphereHitInfo = rayEllipsoidIntersection(u_earthCenter, scatterPoint, u_sunDir, u_inverseAtmosphereScaleInverseRotationMatrix, u_atmosphereScaleMatrix);
      // TODO: Calculate an appropriate number of samples for sun ray optical depth based off the stepSize (so we don't take too many samples when the density doesn't change much)
      float sunRayOpticalDepthToScatterPoint = opticalDepth(scatterPoint, u_sunDir, sunRayAtmosphereHitInfo[1], u_numOpticalDepthPoints);

      float totalOpticalDepthOfSunRay = (sunRayOpticalDepthToScatterPoint + opticalDepthFromRayOriginToSamplePoints[i]) / diameterOfEarthAtEquator; // We scale by earth diameter purely to obtain values that are easier to work with
      amountOfLightScatteredAway += exp(-totalOpticalDepthOfSunRay);
    }

    scatterPoint += step;
  }

  // Scattering coefficients adjust the amount of light scattered by color. (e.g. earth's atmosphere scatters shorter wavelengths more than longer ones)
  // Scale by stepSize to account for larger atmospheres scattering more light
  vec3 totalLightFromSun = u_scatteringCoefficients * u_inScatteringIntensity * stepSize * amountOfLightScatteredAway;

  // float totalViewRayOpticalDepth = exp(-opticalDepthFromRayOriginToSamplePoints[numPartitions] / diameterOfEarthAtEquator);
  if (earthHitInfo[1] > 0.0) { // view ray looks at the earth

    // float brightnessAdaption = (totalLightFromSun.r + totalLightFromSun.g + totalLightFromSun.b) * u_reflectedLightStrength;
    // float reflectedLightStrength = exp(-totalViewRayOpticalDepth) * u_outScatteringIntensity + brightnessAdaption;

    // totalLightFromSun += baseColor * reflectedLightStrength
  } else { // view ray looks into space
    // Assume original colors originate outside the atmosphere and must travel along the entire view ray to reach the camera.
    // float lightTransmittedFromBaseColor = densityAtPoint(rayOrigin) * exp(-totalViewRayOpticalDepth) * distanceThroughAtmosphere * u_scatteringCoefficients * u_inScatteringIntensity;
    // vec3 scatteredLightFromBaseColor = baseColor.rgb * lightTransmittedFromBaseColor;
    // totalLightFromSun += scatteredLightFromBaseColor;
  }

  return vec3(totalLightFromSun);
}
`;

// /**
//  *
//  */
// const computeReflectedLight = `
// vec3 computeReflectedLight(vec3 inScatteredLight, float viewRayOpticalDepth, vec3 baseColor) {
//   float reflectedLightOutScatterStrength = 3.0;
//   float brightnessAdaption = (inScatteredLight.r + inScatteredLight.g + inScatteredLight.b) * u_brightnessAdaptionStrength;
//   float brightnessSum = viewRayOpticalDepth / u_earthScaleMatrix[2][2] * u_outScatteringIntensity * reflectedLightOutScatterStrength + brightnessAdaption;
//   float reflectedLightStrength = exp(-brightnessSum);
//   float hdrStrength = clamp((baseColor.r + baseColor.g + baseColor.b) / 3.0 - 1.0, 0.0, 1.0);
//   reflectedLightStrength = mix(reflectedLightStrength, 1.0, hdrStrength);
//   return baseColor * reflectedLightStrength;
// }
// `;

/**
 *
 */
const computeAtmosphericScatteringFragmentFromVaryings = `
vec3 computeAtmosphericScatteringFragment() {
  return v_atmosphericScattering;
}
`;

/**
 *
 */
const computeAtmosphericScatteringFragmentOnSky = `
vec3 computeAtmosphericScatteringFragment() {
  return computeAtmosphericScattering(true);
}
`;

/**
 *
 */
const computeAtmosphericScatteringFragmentOnRealityMesh = `
vec3 computeAtmosphericScatteringFragment() {
  return computeAtmosphericScattering(false);
}
`;

// #endregion ELLIPSOID

// #region MAIN

const mixAtmosphericScatteringWithBaseColor = `
vec4 mixAtmosphericScatteringWithBaseColor(vec3 atmosphericScatteringColor, vec4 baseColor) {
  // TODO: redefine HDR using an exponential curve
  // float averageColorStrength = (totalLightFromSun.r + totalLightFromSun.g + totalLightFromSun.b) / 3.0;
  // float hdrStrength = clamp(, 0.0, 1.0);
  // reflectedLightStrength = mix(atmosphericScatteringColor, 1.0, hdrStrength);
  return vec4(atmosphericScatteringColor, baseColor.a);
}
`;

const applyAtmosphericScattering = `
  vec3 atmosphericScatteringColor = computeAtmosphericScatteringFragment();
  vec3 result = atmosphericScatteringColor - vec3(u_outScatteringIntensity);
  return mixAtmosphericScatteringWithBaseColor(result, baseColor);
`;

const addMainShaderUniforms = (shader: FragmentShaderBuilder | VertexShaderBuilder) => {
  shader.addUniform(
    "u_densityFalloff",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_densityFalloff", (uniform, params) => {
        params.target.uniforms.atmosphere.bindDensityFalloff(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_scatteringCoefficients",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_scatteringCoefficients", (uniform, params) => {
        params.target.uniforms.atmosphere.bindScatteringCoefficients(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_numInScatteringPoints",
    VariableType.Int,
    (prog) => {
      prog.addProgramUniform("u_numInScatteringPoints", (uniform, params) => {
        params.target.uniforms.atmosphere.bindNumInScatteringPoints(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_numOpticalDepthPoints",
    VariableType.Int,
    (prog) => {
      prog.addProgramUniform("u_numOpticalDepthPoints", (uniform, params) => {
        params.target.uniforms.atmosphere.bindNumOpticalDepthPoints(
          uniform
        );
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_sunDir",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_sunDir", (uniform, params) => {
        params.target.uniforms.bindSunDirection(uniform);
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_earthCenter",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_earthCenter", (uniform, params) => {
        params.target.uniforms.atmosphere.bindEarthCenter(uniform);
      });
    },
    VariablePrecision.High
  );
  // shader.addUniform(
  //   "u_inverseEllipsoidRotationMatrix",
  //   VariableType.Mat3,
  //   (prog) => {
  //     prog.addProgramUniform("u_inverseEllipsoidRotationMatrix", (uniform, params) => {
  //       params.target.uniforms.atmosphere.bindInverseEllipsoidRotationMatrix(uniform);
  //     });
  //   },
  //   VariablePrecision.High
  // );
  shader.addUniform(
    "u_atmosphereScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_atmosphereScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_atmosphereRadiusScaleFactor",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_atmosphereRadiusScaleFactor", (uniform, params) => {
        params.target.uniforms.atmosphere.bindAtmosphereRadiusScaleFactor(uniform);
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_inScatteringIntensity",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_inScatteringIntensity", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInScatteringIntensity(uniform);
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_inverseAtmosphereScaleInverseRotationMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseAtmosphereScaleInverseRotationMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseRotationInverseAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_inverseEarthScaleInverseRotationMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseEarthScaleInverseRotationMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseRotationInverseEarthScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_inverseRotationInverseMinDensityScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseRotationInverseMinDensityScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseRotationInverseMinDensityScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
  shader.addUniform(
    "u_isCameraEnabled",
    VariableType.Boolean,
    (prog) => {
      prog.addProgramUniform("u_isCameraEnabled", (uniform, params) => {
        params.target.uniforms.atmosphere.bindIsCameraEnabled(uniform);
      });
    }
  );
  // shader.addUniform(
  //   "u_brightnessAdaptionStrength",
  //   VariableType.Float,
  //   (prog) => {
  //     prog.addProgramUniform("u_brightnessAdaptionStrength", (uniform, params) => {
  //       params.target.uniforms.atmosphere.bindBrightnessAdaptationStrength(uniform);
  //     });
  //   },
  //   VariablePrecision.High
  // );
  // shader.addUniform(
  //   "u_outScatteringIntensity",
  //   VariableType.Float,
  //   (prog) => {
  //     prog.addProgramUniform("u_outScatteringIntensity", (uniform, params) => {
  //       params.target.uniforms.atmosphere.bindOutScatteringIntensity(uniform);
  //     });
  //   },
  //   VariablePrecision.High
  // );
  shader.addUniform(
    "u_earthScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_earthScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindEarthScaleMatrix(uniform);
      });
    },
    VariablePrecision.High
  );
};

/** Adds the atmospheric effect to a technique
 * @internal
 * @param perFragmentCompute If true, the effect is computed per fragment as opposed to per vertex.
 */
export function addAtmosphericScatteringEffect(
  builder: ProgramBuilder,
  isSkyBox: boolean,
  perFragmentCompute = false,
) {
  const mainShader = perFragmentCompute ? builder.frag : builder.vert;

  mainShader.addConstant("MAX_FLOAT", VariableType.Float, "3.402823466e+38");
  mainShader.addConstant("MAX_SAMPLE_POINTS", VariableType.Int, `${MAX_SAMPLE_POINTS}`);

  addMainShaderUniforms(mainShader);

  mainShader.addFunction(computeRayOrigin);
  mainShader.addFunction(computeRayDir);
  mainShader.addFunction(computeSceneDepthDefault);
  mainShader.addFunction(raySphere);
  mainShader.addFunction(rayEllipsoidIntersection);
  mainShader.addFunction(densityAtPoint);
  mainShader.addFunction(opticalDepth);
  // mainShader.addFunction(computeReflectedLight);

  if (perFragmentCompute) {
    builder.frag.addFunction(computeAtmosphericScatteringFromScratch);
    if (isSkyBox) {
      builder.frag.addFunction(computeAtmosphericScatteringFragmentOnSky);
    } else {
      builder.frag.addFunction(computeAtmosphericScatteringFragmentOnRealityMesh);
    }
  } else {
    const functionCall = isSkyBox ? `computeAtmosphericScattering(true)` : `computeAtmosphericScattering(false)`;
    builder.addFunctionComputedVaryingWithArgs("v_atmosphericScattering", VariableType.Vec3, functionCall, computeAtmosphericScatteringFromScratch);
    builder.frag.addFunction(computeAtmosphericScatteringFragmentFromVaryings);
  }

  // builder.frag.addUniform(
  //   "u_isEnabled",
  //   VariableType.Boolean,
  //   (prog) => {
  //     prog.addProgramUniform("u_isEnabled", (uniform, params) => {
  //       params.target.uniforms.atmosphere.bindIsEnabled(uniform);
  //     });
  //   },
  // );
  builder.frag.addUniform(
    "u_outScatteringIntensity",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_outScatteringIntensity", (uniform, params) => {
        params.target.uniforms.atmosphere.bindOutScatteringIntensity(uniform);
      });
    },
    VariablePrecision.High
  );
  builder.frag.addFunction(mixAtmosphericScatteringWithBaseColor);
  builder.frag.set(FragmentShaderComponent.ApplyAtmosphericScattering, applyAtmosphericScattering);
}

// #endregion MAIN

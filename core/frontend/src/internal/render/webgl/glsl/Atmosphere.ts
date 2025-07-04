/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MAX_SAMPLE_POINTS } from "../AtmosphereUniforms";
import {
  FragmentShaderBuilder,
  FragmentShaderComponent,
  ProgramBuilder,
  VariablePrecision,
  VariableType,
  VertexShaderBuilder,
  VertexShaderComponent,
} from "../ShaderBuilder";

const computeRayDir = `
vec3 computeRayDir(vec3 eyeSpace) {
  bool isCameraEnabled = u_frustum.z == 2.0;
  return isCameraEnabled ? normalize(eyeSpace) : vec3(0.0, 0.0, -1.0);
}
`;

const computeSceneDepthDefault = `
float computeSceneDepth(vec3 eyeSpace) {
  bool isCameraEnabled = u_frustum.z == 2.0;
  return isCameraEnabled ? length(eyeSpace) : -eyeSpace.z;
}
`;

const computeSceneDepthSky = `
float computeSceneDepth(vec3 eyeSpace) {
  return MAX_FLOAT;
}
`;

const computeRayOrigin = `
vec3 computeRayOrigin(vec3 eyeSpace) {
  bool isCameraEnabled = u_frustum.z == 2.0;
  return isCameraEnabled ? vec3(0.0) : vec3(eyeSpace.xy, 0.0);
}
`;

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
 * Next, the coordinate space is scaled down by the ellipsoidScaleMatrix such that it becomes a unit sphere.
 * Then, intersection with the unit sphere is computed
 * Finally, the coordinates are transformed back to their original scale and returned.
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
 * @param earthCenter - The location of the earth center in eye space
 * @param atmosphereRadiusScaleFactor - A scalar that, when multiplied by the earth's radius, produces the atmosphere's radius from the earth center
 * @param atmosphereMaxDensityThresholdScaleFactor - A scalar that, when multiplied by the earth's radius, produces the atmosphere max density threshold's
 * @param densityFalloff - Adjusts how fast the density drops off relative to altitude. A value of 0 produces linear dropoff (1/10 of the way up means you have 9/10 density), and higher values increase the rate of dropoff exponentially.
 * @returns A density value between [0.0 - 1.0].
 */
const densityAtPoint = `
float densityAtPoint(vec3 point, vec3 earthCenter, float atmosphereRadiusScaleFactor, float atmosphereMaxDensityThresholdScaleFactor, float densityFalloff) {
  // Scaling by the inverse earth scale matrix produces a vector with length 1 when the sample point lies on the earth's surface.
  //   This allows us to directly compare the vector's length to the atmosphere scale factors to determine its relative altitude.
  vec3 pointFromEarthCenter = u_inverseEarthScaleInverseRotationMatrix * (point - earthCenter);

  if (length(pointFromEarthCenter) <= atmosphereMaxDensityThresholdScaleFactor) { // point is below the max density threshold
    return 1.0;
  }
  else if (length(pointFromEarthCenter) >= atmosphereRadiusScaleFactor) { // point is above the min density threshold
    return 0.0;
  }

  float atmosphereDistanceFromMaxDensityThreshold = atmosphereRadiusScaleFactor - atmosphereMaxDensityThresholdScaleFactor;
  float samplePointDistanceFromMaxDensityThreshold = length(pointFromEarthCenter) - atmosphereMaxDensityThresholdScaleFactor;
  float heightFrom0to1 = samplePointDistanceFromMaxDensityThreshold / atmosphereDistanceFromMaxDensityThreshold;
  float result = exp(-heightFrom0to1 * densityFalloff) * (1.0 - heightFrom0to1);

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
 * @param earthCenter - The location of the earth center in eye space
 * @param atmosphereRadiusScaleFactor - A scalar that, when multiplied by the earth's radius, produces the atmosphere's radius from the earth center
 * @param atmosphereMaxDensityThresholdScaleFactor - A scalar that, when multiplied by the earth's radius, produces the atmosphere max density threshold's radius from the earth center
 * @param densityFalloff - Adjusts how fast the density drops off relative to altitude. A value of 0 produces linear dropoff (1/10 of the way up means you have 9/10 density), and higher values increase the rate of dropoff exponentially.
 * @returns A float in the range [0.0, rayLength] representing optical depth.
 */
const opticalDepth = `
float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength, int numSamplePoints, vec3 earthCenter, float atmosphereRadiusScaleFactor, float atmosphereMaxDensityThresholdScaleFactor, float densityFalloff) {
  if (numSamplePoints <= 1) {
    return densityAtPoint(rayOrigin, earthCenter, atmosphereRadiusScaleFactor, atmosphereMaxDensityThresholdScaleFactor, densityFalloff) * rayLength;
  }

  int numPartitions = numSamplePoints - 1;
  float stepSize = rayLength / float(numPartitions);
  vec3 samplePointA = rayOrigin;
  vec3 samplePointB = rayOrigin + (rayDir * stepSize);
  float samplePointADensity = densityAtPoint(samplePointA, earthCenter, atmosphereRadiusScaleFactor, atmosphereMaxDensityThresholdScaleFactor, densityFalloff);
  float trapezoidRuleSum = 0.0;

  // To approximate the atmospheric density over the ray, we utilize the trapezoid rule, taking 2 density samples at each step, and averaging them before multiplying by the step size.
  // For performance benefit, we divide by 2 and multiply by stepSize after all steps are summed instead of every loop.
  for (int i = 1; i <= numPartitions; i++) {
    float samplePointBDensity = densityAtPoint(samplePointB, earthCenter, atmosphereRadiusScaleFactor, atmosphereMaxDensityThresholdScaleFactor, densityFalloff);

    trapezoidRuleSum += samplePointADensity + samplePointBDensity;
    samplePointADensity = samplePointBDensity;
    samplePointB += rayDir * stepSize;
  }

  float opticalDepth = trapezoidRuleSum * stepSize / 2.0;
  return opticalDepth;
}
`;

/**
 * Calculates the amount of light scattered toward the camera by atmospheric interference.
 * Returned value is a matrix containing two vec3's.
 *   The first is the color of light scattered by the atmosphere alone.
 *   The second is the intensity of light reflected by surface scattering.
 * The second value must be combined with the actual color of the surface to calculate the final color of the surface.
 * Because the sky is not a surface, surface scattering is not computed when applying the effect to a skybox.
 */
const computeAtmosphericScatteringFromScratch = `
mat3 computeAtmosphericScattering(bool isSkyBox) {
  mat3 emptyResult = mat3(vec3(0.0), vec3(1.0), vec3(0.0));
  vec3 rayDir = computeRayDir(v_eyeSpace);
  vec3 rayOrigin = computeRayOrigin(v_eyeSpace);
  float sceneDepth = computeSceneDepth(v_eyeSpace);
  float diameterOfEarthAtPole = u_earthScaleMatrix[2][2];
  vec3 earthCenter = vec3(u_atmosphereData[2]);

  vec2 earthHitInfo = rayEllipsoidIntersection(earthCenter, rayOrigin, rayDir, u_inverseEarthScaleInverseRotationMatrix, u_earthScaleMatrix);
  vec2 atmosphereHitInfo = rayEllipsoidIntersection(earthCenter, rayOrigin, rayDir, u_inverseAtmosphereScaleInverseRotationMatrix, u_atmosphereScaleMatrix);

  float distanceThroughAtmosphere = min(
    atmosphereHitInfo[1],
    min(sceneDepth, earthHitInfo[0] - atmosphereHitInfo[0])
  );

  if (distanceThroughAtmosphere <= 0.0) {
    return emptyResult;
  }

  // Because the skybox is drawn behind the earth, atmospheric effects do not need to be calculated on the skybox where the earth is obscuring it
  float ignoreDistanceThreshold = diameterOfEarthAtPole * 0.15; // need to accomodate a small threshold to ensure skybox atmosphere overlaps with the uneven earth mesh
  bool ignoreRaycastsIntersectingEarth = isSkyBox;
  if (ignoreRaycastsIntersectingEarth && earthHitInfo[1] > ignoreDistanceThreshold) {
    return emptyResult;
  }

  int numPartitions = int(u_atmosphereData[1][0]) - 1;
  if (numPartitions <= 0) {
    return emptyResult;
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

  float stepSize = distanceThroughAtmosphere / float(numPartitions);
  vec3 step = rayDir * stepSize;
  vec3 firstPointInAtmosphere = rayDir * atmosphereHitInfo[0] + rayOrigin;
  vec3 scatterPoint = firstPointInAtmosphere;

  float atmosphereRadiusScaleFactor = u_atmosphereData[0][0];
  float atmosphereMaxDensityThresholdScaleFactor = u_atmosphereData[0][1];
  float densityFalloff = u_atmosphereData[0][2];
  vec3 scatteringCoefficients = vec3(u_atmosphereData[3]);

  float opticalDepthFromRayOriginToSamplePoints[MAX_SAMPLE_POINTS];
  // The first sample point either lies at the edge of the atmosphere (camera is in space) or exactly at the ray origin (camera is in the atmosphere).
  // In both cases, the distance traveled through the atmosphere to this point is 0.
  opticalDepthFromRayOriginToSamplePoints[0] = 0.0;

  vec3 lightScatteredTowardsCamera = vec3(0.0);
  float opticalDepthFromSunToCameraThroughLastSamplePoint = 0.0;

  for (int i = 1; i <= numPartitions; i++) {
    float opticalDepthForCurrentPartition = opticalDepth(scatterPoint, rayDir, stepSize, 2, earthCenter, atmosphereRadiusScaleFactor, atmosphereMaxDensityThresholdScaleFactor, densityFalloff);
    opticalDepthFromRayOriginToSamplePoints[i] = opticalDepthForCurrentPartition + opticalDepthFromRayOriginToSamplePoints[i-1];

    vec2 sunRayAtmosphereHitInfo = rayEllipsoidIntersection(earthCenter, scatterPoint, u_sunDir, u_inverseAtmosphereScaleInverseRotationMatrix, u_atmosphereScaleMatrix);
    int numSunRaySamples = int(u_atmosphereData[1][1]);
    float sunRayOpticalDepthToScatterPoint = opticalDepth(scatterPoint, u_sunDir, sunRayAtmosphereHitInfo[1], numSunRaySamples, earthCenter, atmosphereRadiusScaleFactor, atmosphereMaxDensityThresholdScaleFactor, densityFalloff);

    float totalOpticalDepthFromSunToCamera = (sunRayOpticalDepthToScatterPoint + opticalDepthFromRayOriginToSamplePoints[i]) / diameterOfEarthAtPole; // We scale by earth diameter purely to obtain values that are easier to work with
    float averageDensityAcrossPartition = opticalDepthForCurrentPartition / stepSize;
    vec3 outScatteredLight = scatteringCoefficients * totalOpticalDepthFromSunToCamera;

    // The amount of light scattered towards the camera at a scatter point is related to the inverse exponential of the amount of light scattered away along its path
    //   In more intuitive terms: There's exponentially less light left to scatter towards the camera deeper in the atmosphere because it's all scattered away by the time it gets to the sample point.
    // This value is then scaled by the density at the scatter point, because a denser atmosphere scatters more light.
    //   In more intuitive terms: Just because a lot of sunlight reaches a scatter point, doesn't mean it'll all reach the camera. High atmosphere sample points receive much light, but do not convey much of that light to the camera.

    lightScatteredTowardsCamera += averageDensityAcrossPartition * exp(-outScatteredLight);

    opticalDepthFromSunToCameraThroughLastSamplePoint = totalOpticalDepthFromSunToCamera;
    scatterPoint += step;
  }

  // Scattering coefficients adjust the amount of light scattered by color. (e.g. earth's atmosphere scatters shorter wavelengths more than longer ones)
  float stepSizeByEarthDiameter = (stepSize / diameterOfEarthAtPole);
  vec3 totalLightScatteredTowardsCamera = scatteringCoefficients * stepSizeByEarthDiameter * lightScatteredTowardsCamera;

  vec3 reflectedLightIntensity = isSkyBox ? vec3(1.0) : calculateReflectedLightIntensity(opticalDepthFromSunToCameraThroughLastSamplePoint, scatteringCoefficients);

  return mat3(totalLightScatteredTowardsCamera, reflectedLightIntensity, vec3(0.0));
}
`;

/**
 * Computes the intensity of light (by color) directly reflected toward the camera by a surface.
 */
/**
 * Computes the intensity of light (by color) directly reflected toward the camera by a surface.
 * @param opticalDepth - The average atmospheric density between the camera and the ground, multiplied by its length
 * @param scatteringCoefficients - A vector containing the scattering strengths of red, green, and blue light, respectively
 * @returns A float in the range [0.0, rayLength] representing optical depth.
 */
const calculateReflectedLightIntensity = `
vec3 calculateReflectedLightIntensity(float opticalDepth, vec3 scatteringCoefficients) {
    // Using only the wavelength-specific scattering to calculate surface scattering results in too much red light on the surface in areas experiencing sunset
    //   This effect can be seen from space near the solar terminator line, but it most egregious when near the ground in an area affected by twilight.
    //   To lessen the amount of red light in the surface scattering, I have chosen to adjust the overall scattering intensity of each wavelength toward the average scattering value between them.
    //   This results in a more uniform scattering of light, producing sunsets that are still dark but without an overpowering red hue.
    //   By rough visual inspection, an equal interpolation between the two extremes retains a bit of ambient red without removing it entirely.
    //   Because this interpolation only occurs here during surface scattering, the vibrant sky color during sunset is unaffected.
    // Note: This workaround may not be needed if an absolute sun position is used instead of a sun direction.
    //   This would affect the angle at which sun rays hit the atmosphere, which is most extreme at sunset.
    //   The efficacy of this technique should be reevaluated if a feature is added which affects the surface scattering behavior.

    float averageScatteringValue = (scatteringCoefficients.x + scatteringCoefficients.y + scatteringCoefficients.z) / 3.0;
    vec3 equalScatteringByWavelength = vec3(averageScatteringValue);
    vec3 scatteringStrength = mix(equalScatteringByWavelength, scatteringCoefficients, 0.5);
    vec3 outScatteredLight = opticalDepth * scatteringStrength;

    vec3 sunlightColor = vec3(1.0, 0.95, 0.925);
    vec3 reflectedLightIntensity = sunlightColor * exp(-outScatteredLight);
    return reflectedLightIntensity;
}
`;

const computeAtmosphericScatteringVaryingsOnSky = `
  mat3 atmosphericScatteringOutput = computeAtmosphericScattering(true);
  v_atmosphericScatteringColor = atmosphericScatteringOutput[0];
  v_reflectedLightIntensity = atmosphericScatteringOutput[1];
`;

const computeAtmosphericScatteringVaryingsOnRealityMesh = `
  mat3 atmosphericScatteringOutput = computeAtmosphericScattering(false);
  v_atmosphericScatteringColor = atmosphericScatteringOutput[0];
  v_reflectedLightIntensity = atmosphericScatteringOutput[1];
`;

const computeAtmosphericScatteringFragmentFromVaryings = `
mat3 computeAtmosphericScatteringFragment() {
  return mat3(v_atmosphericScatteringColor, v_reflectedLightIntensity, vec3(0.0));
}
`;

const computeAtmosphericScatteringFragmentOnSky = `
mat3 computeAtmosphericScatteringFragment() {
  return computeAtmosphericScattering(true);
}
`;

const computeAtmosphericScatteringFragmentOnRealityMesh = `
mat3 computeAtmosphericScatteringFragment() {
  return computeAtmosphericScattering(false);
}
`;

/**
 * Applies a rudimentary high-dynamic range effect to compress potentially over-exposed colors into an acceptable range.
 * This approach uses an exponential curve, which preserves relative color intensity, at the cost of a loss in saturation.
 */
const applyHdr = `
vec3 applyHdr(vec3 color) {
  float exposure = u_exposure;
  vec3 colorWithHdr = 1.0 - exp(-exposure * color);

  return colorWithHdr;
}
`;

const applyAtmosphericScattering = `
  mat3 atmosphericScatteringOutput = computeAtmosphericScatteringFragment();
  vec3 atmosphericScatteringColor = atmosphericScatteringOutput[0];

  vec3 reflectedLightIntensity = atmosphericScatteringOutput[1];
  vec3 reflectedLightColor = reflectedLightIntensity * baseColor.rgb;

  return vec4(applyHdr(atmosphericScatteringColor + reflectedLightColor), baseColor.a);
`;

const addMainShaderUniforms = (shader: FragmentShaderBuilder | VertexShaderBuilder) => {
  shader.addUniform(
    "u_atmosphereData",
    VariableType.Mat4,
    (prog) => {
      prog.addProgramUniform("u_atmosphereData", (uniform, params) => {
        uniform.setMatrix4(params.target.uniforms.atmosphere.atmosphereData);
      });
    },
  );
  shader.addUniform(
    "u_sunDir",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_sunDir", (uniform, params) => {
        params.target.uniforms.bindSunDirection(uniform);
      });
    },
    VariablePrecision.High,
  );
  shader.addUniform(
    "u_atmosphereScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_atmosphereScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High,
  );
  shader.addUniform(
    "u_inverseAtmosphereScaleInverseRotationMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseAtmosphereScaleInverseRotationMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseRotationInverseAtmosphereScaleMatrix(uniform);
      });
    },
    VariablePrecision.High,
  );
  shader.addUniform(
    "u_inverseEarthScaleInverseRotationMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_inverseEarthScaleInverseRotationMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindInverseRotationInverseEarthScaleMatrix(uniform);
      });
    },
    VariablePrecision.High,
  );
  shader.addUniform(
    "u_earthScaleMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_earthScaleMatrix", (uniform, params) => {
        params.target.uniforms.atmosphere.bindEarthScaleMatrix(uniform);
      });
    },
    VariablePrecision.High,
  );
  shader.addUniform("u_frustum", VariableType.Vec3, (prg) => {
    prg.addGraphicUniform("u_frustum", (uniform, params) => {
      uniform.setUniform3fv(params.target.uniforms.frustum.frustum); // { near, far, type }
    });
  });
};

/** Adds the atmospheric effect to a technique
 * @internal
 * @param perFragmentCompute If true, the effect is computed per fragment as opposed to per vertex.
 */
export function addAtmosphericScatteringEffect(
  builder: ProgramBuilder,
  isSkyBox: boolean,
  perFragmentCompute: boolean,
) {
  const mainShader = perFragmentCompute ? builder.frag : builder.vert;

  mainShader.addConstant("MAX_FLOAT", VariableType.Float, "3.402823466e+38");
  mainShader.addConstant("MAX_SAMPLE_POINTS", VariableType.Int, `${MAX_SAMPLE_POINTS}`);

  addMainShaderUniforms(mainShader);

  mainShader.addFunction(computeRayOrigin);
  mainShader.addFunction(computeRayDir);
  if (isSkyBox) {
    mainShader.addFunction(computeSceneDepthSky);
  } else {
    mainShader.addFunction(computeSceneDepthDefault);
  }
  mainShader.addFunction(raySphere);
  mainShader.addFunction(rayEllipsoidIntersection);
  mainShader.addFunction(densityAtPoint);
  mainShader.addFunction(opticalDepth);
  mainShader.addFunction(calculateReflectedLightIntensity);

  if (perFragmentCompute) {
    builder.frag.addFunction(computeAtmosphericScatteringFromScratch);
    if (isSkyBox) {
      builder.frag.addFunction(computeAtmosphericScatteringFragmentOnSky);
    } else {
      builder.frag.addFunction(computeAtmosphericScatteringFragmentOnRealityMesh);
    }
  } else {
    builder.vert.addFunction(computeAtmosphericScatteringFromScratch);
    builder.addVarying("v_atmosphericScatteringColor", VariableType.Vec3);
    builder.addVarying("v_reflectedLightIntensity", VariableType.Vec3);
    if (isSkyBox) {
      builder.vert.set(VertexShaderComponent.ComputeAtmosphericScatteringVaryings, computeAtmosphericScatteringVaryingsOnSky);
    } else {
      builder.vert.set(VertexShaderComponent.ComputeAtmosphericScatteringVaryings, computeAtmosphericScatteringVaryingsOnRealityMesh);
    }
    builder.frag.addFunction(computeAtmosphericScatteringFragmentFromVaryings);
  }

  builder.frag.addUniform(
    "u_exposure",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_exposure", (uniform, params) => {
        params.target.uniforms.atmosphere.bindExposure(uniform);
      });
    },
    VariablePrecision.High,
  );
  builder.frag.addFunction(applyHdr);
  builder.frag.set(FragmentShaderComponent.ApplyAtmosphericScattering, applyAtmosphericScattering);
}

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
import { Matrix3 } from "../Matrix";
import { assert } from "@itwin/core-bentley";
import { WebGLContext } from "@itwin/webgl-compatibility";
import { ShaderProgram } from "../ShaderProgram";
import { AttributeMap } from "../AttributeMap";
import { AtmosphericScatteringViewportQuadGeometry } from "../CachedGeometry";

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

const computeSceneDepthRealityMesh = `
  float computeSceneDepth(vec3 rayDirection) {
    if (u_isMapTile)
      return projectedOntoEarthEllipsoidSceneDepth(rayDirection);
    return length(v_eyeSpace);
  }
`;

const computeSceneDepthSky = `
  float computeSceneDepth(vec3 rayDirection) {
    return max_float;
  }
`;

// #endregion GENERAL
// #region SPHERE

/**
 *
 * @param ellipsoidCenter - Center of globe (earth) in view coordinates.
 * @param ellipsoidMatrix - Rotation matrix from Ecef to world.
 * @param viewMatrix - Rotation matrix from world to view.
 * @param ellipsoidRadii - Radiuses of ellipsoid in Ecef coordinate space.
 * @param rayOrigin
 * @param rayDirection
 * @returns
 */
const rayEllipsoidIntersectionGeneric = `
vec2 rayEllipsoidIntersection(vec3 ellipsoidCenter, mat3 ellipsoidMatrix, mat3 viewMatrix, vec3 ellipsoidRadii, vec3 rayOrigin, vec3 rayDirection) {
  vec3 ro, rd;

  // transform ray to be relative to sphere
  mat3 inverseRotation = inverse(ellipsoidMatrix) * inverse(viewMatrix); // uniform
  rd = inverseRotation * rayDirection;
  ro = inverseRotation * (rayOrigin - ellipsoidCenter); // uniform for rayOrigin - ellipsoidCenter

  mat3 scale = mat3(ellipsoidRadii.x, 0.0, 0.0, 0.0, ellipsoidRadii.y, 0.0, 0.0, 0.0, ellipsoidRadii.z);
  mat3 scaleInverse = inverse(scale);

  vec3 rdi = normalize(scaleInverse * rd);
  vec3 roi = scaleInverse * ro;

  vec2 toAndThrough = raySphere(vec3(0.0), 1.0, roi, rdi);
  if (toAndThrough[1] > 0.0) {
    vec3 pt = roi + rdi * toAndThrough[0];
    return vec2(
      distance(ro, scale * pt),
      distance(scale * pt, scale * (pt + rdi * toAndThrough[1]))
    );
  }
  return toAndThrough;
}
`;

const eyeAtmosphereIntersection = `
vec2 eyeAtmosphereIntersection(vec3 rayDirection) {

  // transform ray to be relative to sphere
  vec3 rd = normalize(u_inverseAtmosphereScaleMatrix * u_inverseEllipsoidRotationMatrix * rayDirection);

  vec2 toAndThrough = raySphere(vec3(0.0), 1.0, u_atmosphereToEyeInverseScaled, rd);
  if (toAndThrough[1] > 0.0) {
    vec3 pt = u_atmosphereToEyeInverseScaled + rd * toAndThrough[0];
    return vec2(
      distance(u_ellipsoidToEye, u_atmosphereScaleMatrix * pt),
      distance(u_atmosphereScaleMatrix * pt, u_atmosphereScaleMatrix * (pt + rd * toAndThrough[1]))
    );
  }
  return toAndThrough;
}
`;

const eyeEarthIntersection = `
vec2 eyeEarthIntersection(vec3 rayDirection) {

  // transform ray to be relative to sphere
  vec3 rd = normalize(u_inverseEarthScaleMatrix * u_inverseEllipsoidRotationMatrix * rayDirection);

  vec2 toAndThrough = raySphere(vec3(0.0), 1.0, u_earthToEyeInverseScaled, rd);
  if (toAndThrough[1] > 0.0) {
    vec3 pt = u_earthToEyeInverseScaled + rd * toAndThrough[0];
    return vec2(
      distance(u_ellipsoidToEye, u_earthScaleMatrix * pt),
      distance(u_earthScaleMatrix * pt, u_earthScaleMatrix * (pt + rd * toAndThrough[1]))
    );
  }
  return toAndThrough;
}
`;

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

  return vec2(max_float, 0.0);
}
`;

/**
 * Returns
 *
 * @param
 * @param
 * @returns
 */
const opticalDepth = `
float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength) {
  vec3 densitySamplePoint = rayOrigin;
  float stepSize = rayLength / (float(u_numOpticalDepthPoints) - 1.0);
  float opticalDepth = 0.0;
  vec3 rayStep = rayDir * stepSize;

  for (int i = 0; i < u_numOpticalDepthPoints; i ++) {
    float localDensity = densityAtPoint(densitySamplePoint, u_earthCenter, u_earthRadius, u_atmosphereRadius, u_densityFalloff);
    opticalDepth += localDensity * stepSize;
    densitySamplePoint += rayStep;
  }
  return opticalDepth;
}
`;

/**
 * Returns the atmospheric density at a point according to its distance between
 * a minimum and maximum density height. Density decreases exponentially,
 * modulated by a density falloff coefficient.
 *
 * @param densitySamplePoint - Point we want to sample density for.
 * @param sphereCenterPoint - Center point of the sphere responsible for the atmosphere.
 * @param minDensityHeight - Distance from sphereCenterPoint at which density is 0.0.
 * @param maxDensityHeight - Distance from sphereCenterPoint at which density is 1.0.
 * @param densityFalloff - Coefficient modulating density falloff speed.
 * @returns A density value between [0.0 - 1.0].
 */
const densityAtPoint = `
float densityAtPoint(vec3 densitySamplePoint, vec3 sphereCenterPoint, float minDensityHeight, float maxDensityHeight, float densityFalloff) {
  float distanceFromCenter = length(densitySamplePoint - sphereCenterPoint);
  float distanceFromMinHeight = distanceFromCenter - minDensityHeight;
  float isAboveMinHeight = step(0.0, distanceFromMinHeight);
  float minToMaxRatio = isAboveMinHeight * clamp(distanceFromMinHeight / (maxDensityHeight - minDensityHeight), 0.0, 1.0);
  return exp(-minToMaxRatio * densityFalloff) * (1.0 - minToMaxRatio);
}
`;

const calculateScattering = `
vec3 calculateScattering(vec3 rayOrigin, vec3 rayDir, float rayLength, vec3 baseColor) {
  float stepSize = rayLength / (float(u_numInScatteringPoints) - 1.0);
  vec3 inScatteredLight = vec3(0.0);
  float viewRayOpticalDepth = 0.0;

  vec3 dirToSun = -u_sunDir;

  vec3 inScatterPoint = rayOrigin;
  for (int i = 0; i < u_numInScatteringPoints; i++) {
    float sunRayLength = raySphere(u_earthCenter, u_atmosphereRadius, inScatterPoint, dirToSun)[1];
    float sunRayOpticalDepth = opticalDepth(inScatterPoint, dirToSun, sunRayLength);
    viewRayOpticalDepth = opticalDepth(inScatterPoint, -rayDir, stepSize * float(i));
    vec3 transmittance = exp(-(sunRayOpticalDepth + viewRayOpticalDepth) * u_scatteringCoefficients);
    float localDensity = densityAtPoint(inScatterPoint, u_earthCenter, u_earthRadius, u_atmosphereRadius, u_densityFalloff);

    // inScatteredLight += localDensity * transmittance;
    inScatteredLight += localDensity * transmittance * u_scatteringCoefficients * stepSize;
    inScatterPoint += rayDir * stepSize;
  }
  // inScatteredLight *= u_scatteringCoefficients * (stepSize / u_earthRadius);
  float originalColorTransmittance = exp(-viewRayOpticalDepth);
  // if (gl_FragCoord.x / u_vpSize.x > 0.5 && gl_FragCoord.y / u_vpSize.y > 0.5) // TOP RIGHT
  //   return inScatteredLight;
  // if (gl_FragCoord.x / u_vpSize.x > 0.5 && gl_FragCoord.y / u_vpSize.y < 0.5) // BOTTOM RIGHT
  //   return baseColor;
  // if (gl_FragCoord.x / u_vpSize.x < 0.5 && gl_FragCoord.y / u_vpSize.y < 0.5) // BOTTOM LEFT
  //   return vec3(originalColorTransmittance);
  return baseColor * originalColorTransmittance + inScatteredLight; // TOP LEFT
  // return baseColor * originalColorTransmittance; // TOP LEFT
}
`;

const applyAtmosphericScatteringSphere = `
vec4 applyAtmosphericScatteringSphere(vec3 rayDir, float sceneDepth, vec4 baseColor) {
  // We get the distance the ray traveled from the eye to the atmosphere and
  // the distance it traveled in the atmosphere to reach the fragment.

  vec2 atmosphereHitInfo = eyeAtmosphereIntersection(rayDir);
  // vec2 hitInfo = rayEllipsoidIntersection(u_earthCenter, u_earthRotation, u_viewMatrix, atmosphereRadii, rayOrigin, rayDir);
  // vec2 hitInfo = raySphere(u_earthCenter, u_atmosphereRadius, rayOrigin, rayDir);

  float distanceToAtmosphere = atmosphereHitInfo[0];
  // We remove distance through atmosphere beyond the fragment's position
  float distanceThroughAtmosphere = min(atmosphereHitInfo[1], sceneDepth - distanceToAtmosphere);

  if (distanceThroughAtmosphere > 0.0) {
    // point on ray where atmosphere starts
    vec3 pointInAtmosphere = rayDir * (distanceToAtmosphere + epsilon);
    vec3 light = calculateScattering(pointInAtmosphere, rayDir, distanceThroughAtmosphere - epsilon * 2.0, baseColor.rgb);
    // return vec4(1.0, baseColor.gba);
    // return vec4(rayDir, 1.0);
    return vec4(1.0);
    // return vec4(temp, temp, temp, 1.0);
    // return temp;
    // return vec4(debugVal, debugVal, debugVal, 1.0);
    // return vec4(debugVal.rgb, 1.0);
    return vec4(light, baseColor.a);
  }
  // return vec4(0.0, 0.0, 0.0, 1.0);
  // return vec4(1.0, baseColor.gba);
  // return vec4(rayDir, 1.0);
  // return vec4(temp, temp, temp, 1.0);
  // return temp;
  // return vec4(debugVal, debugVal, debugVal, 1.0);
  // return vec4(debugVal.rgb, 1.0);
  return baseColor;
}
`;
// #endregion SPHERE
// #region PLANAR
const opticalDepthPlanar = `
float opticalDepthPlanar(vec3 rayOrigin, vec3 rayDir, float rayLength, vec3 atmospherePlanePoint, vec3 atmospherePlaneNormal) {
  vec3 densitySamplePoint = rayOrigin;
  float stepSize = rayLength / (float(u_numOpticalDepthPoints) - 1.0);
  float opticalDepth = 0.0;
  vec3 rayStep = rayDir * stepSize;

  for (int i = 0; i < u_numOpticalDepthPoints; i ++) {
    float localDensity = densityAtPointPlanar(densitySamplePoint, atmospherePlanePoint, atmospherePlaneNormal);
    opticalDepth += localDensity * stepSize;
    // opticalDepth += localDensity;
    densitySamplePoint += rayStep;
  }
  return opticalDepth;
  // return opticalDepth / float(u_numOpticalDepthPoints);
}
`;

const densityAtPointPlanar = `
float densityAtPointPlanar(vec3 densitySamplePoint, vec3 atmospherePlanePoint, vec3 atmospherePlaneNormal) {
  float heightAboveSurface = getProjectedDistance(atmospherePlanePoint, atmospherePlaneNormal, densitySamplePoint);
  float height01 = clamp(heightAboveSurface / (u_atmosphereRadius - u_earthRadius), 0.0, 1.0);
  float localDensity = exp(-height01 * u_densityFalloff) * (1.0 - height01);
  return localDensity;
}
`;

const applyAtmosphericScatteringPlanar = `
vec4 applyAtmosphericScatteringPlanar(vec3 rayDir, float sceneDepth, vec3 rayOrigin, vec3 dirToSun, vec4 baseColor) {
  vec3 atmospherePlaneNormal = normalize(u_viewMatrix * vec3(0.0, 0.0, 1.0));
  vec3 atmospherePlanePoint = u_earthCenter + u_atmosphereRadius * atmospherePlaneNormal;

  float distanceOriginAtmosphere = getProjectedDistance(atmospherePlaneNormal, atmospherePlanePoint, rayOrigin);
  // float distanceFragAtmosphere = getProjectedDistance(atmospherePlaneNormal, atmospherePlanePoint, rayOrigin+rayDir*sceneDepth);
  // float tempR = abs(distanceFragAtmosphere) <= 1.0 ? 1.0 : 0.0;
  // float tempG = abs(distanceFragAtmosphere) <= 5.0 ? 1.0 : 0.0;
  // float tempB = abs(distanceFragAtmosphere) <= 10.0 ? 1.0 : 0.0;

  float distanceThroughAtmosphere;
  float distanceToAtmosphere;
  vec3 temp;
  float angle = getAngle(rayDir, atmospherePlaneNormal);
  if (PI / 2.0 - angle > epsilon) {
    temp = vec3(1.0, 1.0, 1.0);
    if (distanceOriginAtmosphere > 0.0) {
      distanceThroughAtmosphere = 0.0;
      distanceToAtmosphere = 0.0;
    } else {
      vec3 intersection = linePlaneIntersection(atmospherePlanePoint, atmospherePlaneNormal, rayOrigin, rayDir);
      distanceThroughAtmosphere = min(sceneDepth, min(u_maxAtmosphereDistance, distance(intersection, rayOrigin)));
      distanceToAtmosphere = 0.0;
    }
  } else if (angle - PI / 2.0 > epsilon && PI - angle > epsilon) {
    temp = vec3(0.0, 0.0, 0.0);
    if (distanceOriginAtmosphere < 0.0) {
      distanceThroughAtmosphere = min(sceneDepth, u_maxAtmosphereDistance);
      distanceToAtmosphere = 0.0;
    } else {
      vec3 intersection = linePlaneIntersection(atmospherePlanePoint, atmospherePlaneNormal, rayOrigin, rayDir);
      distanceToAtmosphere = distance(intersection, rayOrigin);
      distanceThroughAtmosphere = min(sceneDepth - distanceToAtmosphere, u_maxAtmosphereDistance);
    }
  } else if (distanceOriginAtmosphere < 0.0) {
    temp = vec3(1.0, 0.0, 0.0);
    distanceThroughAtmosphere = min(sceneDepth, u_maxAtmosphereDistance);
  } else {
    temp = vec3(1.0, 0.0, 0.0);
    distanceThroughAtmosphere = 0.0;
  }

  if (distanceOriginAtmosphere < 0.0)
    temp = vec3(0.0, 0.0, 1.0);
  if (distanceOriginAtmosphere > 0.0)
    temp = vec3(0.0, 1.0, 0.0);
  if (distanceOriginAtmosphere == 0.0)
    temp = vec3(1.0, 0.0, 0.0);

  if (distanceThroughAtmosphere > 0.0) {
    // point on ray where atmosphere starts
    vec3 pointInAtmosphere = rayOrigin + rayDir * (distanceToAtmosphere + epsilon);
    vec3 light = calculateScatteringPlanar(pointInAtmosphere, rayDir, distanceThroughAtmosphere - epsilon * 2.0, dirToSun, baseColor.rgb, atmospherePlanePoint, atmospherePlaneNormal);

    if (gl_FragCoord.x / u_vpSize.x > 0.5 && gl_FragCoord.y / u_vpSize.y > 0.5)
      return vec4(temp, 1.0);
    // return vec4(tempR, tempG, tempB, 1.0);
    return vec4(light, baseColor.a);
  }
  if (gl_FragCoord.x / u_vpSize.x > 0.5 && gl_FragCoord.y / u_vpSize.y > 0.5)
    return vec4(temp, 1.0);
  // return vec4(tempR, tempG, tempB, 1.0);
  return baseColor;
}
`;

const calculateScatteringPlanar = `
vec3 calculateScatteringPlanar(vec3 rayOrigin, vec3 rayDir, float rayLength, vec3 dirToSun, vec3 baseColor, vec3 atmospherePlanePoint, vec3 atmospherePlaneNormal) {
  float stepSize = rayLength / (float(u_numInScatteringPoints) - 1.0);
  vec3 inScatteredLight = vec3(0.0);
  float viewRayOpticalDepth = 0.0;
  float sunRayOpticalDepth;

  float sunAngle = getAngle(dirToSun, atmospherePlaneNormal);
  vec3 earthPlanePoint = u_earthCenter + u_earthRadius * atmospherePlaneNormal;

  vec3 inScatterPoint = rayOrigin;
  for (int i = 0; i < u_numInScatteringPoints; i++) {

    if (PI / 2.0 - sunAngle > epsilon) {
      float sunRayLength = distance(linePlaneIntersection(atmospherePlanePoint, atmospherePlaneNormal, inScatterPoint, dirToSun), inScatterPoint);
      sunRayOpticalDepth = opticalDepthPlanar(inScatterPoint, dirToSun, sunRayLength, atmospherePlanePoint, atmospherePlaneNormal);
    } else if (sunAngle - PI / 2.0 > epsilon) {
      float sunRayLength = distance(linePlaneIntersection(earthPlanePoint, atmospherePlaneNormal, inScatterPoint, dirToSun), inScatterPoint);
      sunRayOpticalDepth = opticalDepthPlanar(inScatterPoint, dirToSun, sunRayLength, atmospherePlanePoint, atmospherePlaneNormal);
    } else {
      float sunRayLength = u_maxAtmosphereDistance;
      sunRayOpticalDepth = opticalDepthPlanar(inScatterPoint, dirToSun, sunRayLength, atmospherePlanePoint, atmospherePlaneNormal);
    }
    viewRayOpticalDepth = opticalDepthPlanar(inScatterPoint, rayDir, stepSize * float(i), atmospherePlanePoint, atmospherePlaneNormal); // validate -rayDir vs rayDir
    vec3 transmittance = exp(-(vec3(sunRayOpticalDepth + viewRayOpticalDepth) * u_scatteringCoefficients));
    float localDensity = densityAtPointPlanar(inScatterPoint, atmospherePlanePoint, atmospherePlaneNormal);

    inScatteredLight += vec3(localDensity) * transmittance;
    // inScatteredLight += vec3(localDensity) * transmittance * u_scatteringCoefficients * vec3(stepSize);
    inScatterPoint += rayDir * stepSize;
  }
  float originalColorTransmittance = exp(-viewRayOpticalDepth);
  inScatteredLight *= u_scatteringCoefficients * stepSize / u_earthRadius;
  // return baseColor * vec3(originalColorTransmittance) + inScatteredLight;
  return baseColor * vec3(originalColorTransmittance) + inScatteredLight / float(u_numInScatteringPoints);

}
`;
// #endregion PLANAR
// #region MISC
const projectedOntoEarthEllipsoidSceneDepth = `
float projectedOntoEarthEllipsoidSceneDepth(vec3 rayDirection) {
  return eyeEarthIntersection(rayDirection)[0];
}
`;

const getAngle = `
// validated
float getAngle(vec3 vector1, vec3 vector2) {
  return acos(dot(vector1, vector2) / (length(vector1) * length(vector2)));
}
`;

const getProjectedDistance = `
// validated
float getProjectedDistance(vec3 planeNormal, vec3 planePoint, vec3 point) {
  // position if point on side of normal, negative else
  vec3 vectorFromPlane = point - planePoint;
  return dot(planeNormal, vectorFromPlane);
}
`;

const isLineIntersectingPlane = `
bool isLineIntersectingPlane(vec3 planePoint, vec3 planeNormal, vec3 linePoint, vec3 lineDir, float epsilon) {
  return abs(dot(planeNormal, lineDir)) > epsilon;
}
`;

const linePlaneIntersection = `
vec3 linePlaneIntersection(vec3 planePoint, vec3 planeNormal, vec3 linePoint, vec3 lineDir) {
  float t = (dot(planeNormal, planePoint) - dot(planeNormal, linePoint)) / dot(planeNormal, lineDir);
  return linePoint + lineDir * t;
}
`;

const getArcAngle = `
float getArcAngle(float arcLength, float sphereRadius) {
  // radians
  return arcLength / sphereRadius;
}
`;

const polarToCartesian = `
vec3 polarToCartesian(float radius, float theta, float phi) {
  // angles are in radians
  // theta is the angle in the x-y (horizontal) plane from 0 to 2pi
  // phi is the angle along the z-axis from 0 to 2pi
  bool isPhiHigherThanPi = phi > PI;
  float phi = isPhiHigherThanPi ? PI - mod(phi, PI) : phi;
  float sinPhi = sin(phi);
  float x = radius * sinPhi * cos(theta);
  float y = radius * sinPhi * sin(theta);
  float z = radius * cos(phi);
  return isPhiHigherThanPi ? vec3(-x, -y, z) : vec3(x, y, z);
}
`;

const projectOntoSphere = `
vec3 projectOntoSphere(vec3 originalPos, vec3 sphereOrigin, float sphereRadius) {
  vec3 sphereToPoint = originalPos - sphereOrigin;
  return sphereOrigin + (sphereRadius / length(sphereToPoint) * sphereToPoint);
}
`;

const getPositionAsIfAlongSphere = `
// relative to top of sphere
// be carefull of positions that are further away than the sphere's circumference
vec3 getPositionAsIfAlongSphere(vec3 position, float sphereRadius) {
  float arcLengthZ = abs(position.z);
  float arcLengthX = abs(position.x);
  float phi = getArcAngle(arcLengthZ, sphereRadius);
  float theta = getArcAngle(arcLengthX, sphereRadius);
  vec3 cartesianPositionWrongAxes = polarToCartesian(position.y, theta, phi);
  return cartesianPositionWrongAxes.yzx * vec3(1.0, 1.0, -1.0);
}
`;
// #endregion MISC

// #region MAIN
const applyAtmosphericScattering = `
  // return baseColor if atmospheric scattering is disabled
  if (!bool(u_isEnabled))
    return baseColor;

  vec3 rayDir = computeRayDir();
  float sceneDepth = computeSceneDepth(rayDir);

  if (u_isPlanar == 1)
    return applyAtmosphericScatteringPlanar(rayDir, sceneDepth, vec3(0.0), -u_sunDir, baseColor);
  return applyAtmosphericScatteringSphere(rayDir, sceneDepth, baseColor);
`;

/** @internal */
export function addAtmosphericScattering(
  builder: ProgramBuilder,
  isSky = false,
  isRealityMesh = false
) {
  assert(!(isSky && isRealityMesh));
  const frag = builder.frag;
  frag.addDefine("PI", "3.1415926538");

  frag.addConstant("epsilon", VariableType.Float, `0.000001`);

  frag.addConstant("max_float", VariableType.Float, "3.402823466e+38");
  frag.addConstant("u_maxAtmosphereDistance", VariableType.Float, "10000.0");
  frag.addConstant("ditherStrength", VariableType.Float, "0.1");

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
    "u_isPlanar",
    VariableType.Int,
    (prog) => {
      prog.addProgramUniform("u_isPlanar", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindIsPlanar(uniform);
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
    "u_viewMatrix",
    VariableType.Mat3,
    (prog) => {
      prog.addProgramUniform("u_viewMatrix", (uniform, params) => {
        uniform.setMatrix3(
          Matrix3.fromMatrix3d(params.target.uniforms.frustum.viewMatrix.matrix)
        );
      });
    },
    VariablePrecision.High
  );

  frag.addUniform(
    "u_earthCenter",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_earthCenter", (uniform, params) => {
        // params.target.uniforms.atmosphericScattering.bindEarthCenter(uniform);
        params.target.uniforms.atmosphericScattering.bindEarthCenterParam(uniform);
      });
    },
    VariablePrecision.High
  );

  // frag.addUniform(
  //   "u_earthRotation",
  //   VariableType.Mat3,
  //   (prog) => {
  //     prog.addProgramUniform("u_earthRotation", (uniform, params) => {
  //       uniform.setMatrix3(
  //         Matrix3.fromMatrix3d(params.target.uniforms.atmosphericScattering.earthRotation)
  //       );
  //     });
  //   },
  //   VariablePrecision.High
  // );

  // frag.addUniform(
  //   "u_earthRadii",
  //   VariableType.Vec3,
  //   (prog) => {
  //     prog.addProgramUniform("u_earthRadii", (uniform, params) => {
  //       params.target.uniforms.atmosphericScattering.bindEarthRadii(uniform);
  //     });
  //   },
  //   VariablePrecision.High
  // );

  frag.addUniform(
    "u_atmosphereRadius",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_atmosphereRadius", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindAtmosphereRadius(
          uniform
        );
      });
    },
    VariablePrecision.High
  );

  frag.addUniform(
    "u_earthRadius",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_earthRadius", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindEarthRadius(uniform);
      });
    },
    VariablePrecision.High
  );

  frag.addUniform(
    "u_vpSize",
    VariableType.Vec2,
    (prog) => {
      prog.addProgramUniform("u_vpSize", (uniform, params) => {
        params.target.uniforms.viewRect.bindDimensions(uniform);
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

  frag.addFunction(raySphere);
  frag.addFunction(rayEllipsoidIntersectionGeneric);
  frag.addFunction(eyeAtmosphereIntersection);

  frag.addFunction(linePlaneIntersection);
  frag.addFunction(isLineIntersectingPlane);
  frag.addFunction(getAngle);
  frag.addFunction(getProjectedDistance);

  frag.addFunction(densityAtPoint);
  frag.addFunction(densityAtPointPlanar);

  frag.addFunction(opticalDepth);
  frag.addFunction(opticalDepthPlanar);

  frag.addFunction(calculateScattering);
  frag.addFunction(calculateScatteringPlanar);

  frag.addFunction(applyAtmosphericScatteringSphere);
  frag.addFunction(applyAtmosphericScatteringPlanar);

  frag.addFunction(computeRayDirDefault);
  if (isSky) {
    frag.addFunction(computeSceneDepthSky);
  } else if (isRealityMesh) {
    frag.addUniform("u_isMapTile", VariableType.Boolean, (program) => {
      program.addGraphicUniform("u_isMapTile", (uniform, params) => {
        uniform.setUniform1i(params.geometry.asRealityMesh!.isMapTile ? 1 : 0);
      });
    });
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
      "u_inverseEarthScaleMatrix",
      VariableType.Mat3,
      (prog) => {
        prog.addProgramUniform("u_inverseEarthScaleMatrix", (uniform, params) => {
          params.target.uniforms.atmosphericScattering.bindInverseEarthScaleMatrix(uniform);
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
    frag.addFunction(eyeEarthIntersection);
    frag.addFunction(projectedOntoEarthEllipsoidSceneDepth);
    frag.addFunction(computeSceneDepthRealityMesh);
  } else {
    frag.addFunction(computeSceneDepthDefault);
  }

  frag.set(
    FragmentShaderComponent.ApplyAtmosphericScattering,
    applyAtmosphericScattering
  );
}
// #endregion MAIN

// #region DEBUG
export function _addAtmosphericScattering(
  builder: ProgramBuilder,
  _isSky = false,
  _isRealityMesh = false
) {
  builder.frag.addConstant("isSky", VariableType.Boolean, _isSky ? "true" : "false");
  builder.frag.addConstant("isMesh", VariableType.Boolean, _isRealityMesh ? "true" : "false");

  builder.frag.addConstant("max_float", VariableType.Float, "3.402823466e+38");
  builder.frag.addDefine("PI", "3.1415926538");
  // addEyeSpace(builder);
  builder.frag.set(
    FragmentShaderComponent.ApplyAtmosphericScattering,
    debugAtmosphericScattering
  );
  builder.frag.addFunction(raySphere);
  // builder.frag.addFunction(getAngle);
  builder.frag.addFunction(projectedOntoEarthEllipsoidSceneDepth);
  // builder.frag.addFunction(computeRayDirDefault);
  builder.frag.addFunction(computeSceneDepthDefault);
  // builder.frag.addUniform("u_frustum", VariableType.Vec3, (prg) => {
  //   prg.addGraphicUniform("u_frustum", (uniform, params) => {
  //     uniform.setUniform3fv(params.target.uniforms.frustum.frustum); // { near, far, type }
  //   });
  // });
  builder.frag.addUniform(
    "u_earthCenter",
    VariableType.Vec3,
    (prog) => {
      prog.addProgramUniform("u_earthCenter", (uniform, params) => {
        params.target.uniforms.atmosphericScattering.bindEarthCenter(uniform);
      });
    },
    VariablePrecision.High
  );
  builder.frag.addUniform(
    "u_earthRadius",
    VariableType.Float,
    (prog) => {
      prog.addProgramUniform("u_earthRadius", (uniform, params) => {
        // params.target.uniforms.atmosphericScattering.bindEarthCenter(uniform);
        params.target.uniforms.atmosphericScattering.bindEarthRadius(uniform);
      });
    },
    VariablePrecision.High
  );
}

const debugAtmosphericScattering = `
  float sceneDepth = computeSceneDepth();
  vec4 debugValue = projectedOntoEarthEllipsoidSceneDepth(v_eyeSpace, u_earthCenter, u_earthRadius) > sceneDepth ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(1.0);

  if (isMesh) {
    return debugValue;
  }
  return baseColor;
  // float angle = getAngle(vec3(0.0, 0.0, -1.0), computeRayDir());
  // float val = angle / (PI / 2.0);
  // float l = length(v_eyeSpace) - u_frustum.x;
  // return vec4(v_eyeSpace.xyz, 1.0);
  // if (l < 0.0)
  //   return vec4(1.0, 0.0, 0.0, 1.0);
  // return vec4(l, l, l, 1.0);
  // // return vec4(v_eyeSpace.xyz, 1.0);
  // // return baseColor;
  // return vec4(val, val, val, 1.0);
  // // return vec4(0.5, 1.0, 0.6, 1.0);

`;
// #endregion DEBUG

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

  addAtmosphericScattering(prog, true);

  prog.vert.headerComment = "//!V! AtmosphericSky";
  prog.frag.headerComment = "//!F! AtmosphericSky";

  return prog.buildProgram(context);
}
// #endregion QUAD

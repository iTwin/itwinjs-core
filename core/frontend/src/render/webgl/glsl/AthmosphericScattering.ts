/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FragmentShaderComponent, ProgramBuilder, VariablePrecision, VariableType } from "../ShaderBuilder";
import { Matrix3 } from "../Matrix";
import { assert } from "@itwin/core-bentley";
import { addEyeSpace } from "./Common";

// #region GENERAL

const computeRayDirDefault = `
  vec3 computeRayDir() {
    return normalize(v_eyeSpace);
  }
`;

const computeSceneDepthDefault = `
  float computeSceneDepth() {
    return length(v_eyeSpace);
  }
`;

const computeSceneDepthRealityMesh = `
  float computeSceneDepth() {
    if (u_isMapTile)
      return getProjectedSceneDepth(v_eyeSpace, u_earthCenter, u_earthRadius);
    return length(v_eyeSpace);
  }
`;

const computeRayDirSky = `
  vec3 computeRayDir() {
    return normalize(u_viewMatrix * v_eyeToVert);
  }
`;

const computeSceneDepthSky = `
  float computeSceneDepth() {
    return max_float;
  }
`;

// #endregion GENERAL
// #region SPHERE
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

const opticalDepth = `
float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength) {
  vec3 densitySamplePoint = rayOrigin;
  float stepSize = rayLength / (float(u_numOpticalDepthPoints) - 1.0);
  float opticalDepth = 0.0;
  vec3 rayStep = rayDir * stepSize;

  for (int i = 0; i < u_numOpticalDepthPoints; i ++) {
    float localDensity = densityAtPoint(densitySamplePoint);
    opticalDepth += localDensity * stepSize;
    densitySamplePoint += rayStep;
  }
  return opticalDepth;
}
`;

const densityAtPoint = `
float densityAtPoint(vec3 densitySamplePoint) {
  float heightAboveSurface = length(densitySamplePoint - u_earthCenter) - u_earthRadius;
  float isAboveSurface = step(heightAboveSurface, 0.0);
  // float height01 = clamp(heightAboveSurface / (u_atmosphereRadius - u_earthRadius), 0.0, 1.0);
  float height01 = clamp(1.0 * heightAboveSurface / (u_atmosphereRadius - u_earthRadius), 0.0, 1.0);
  float localDensity = exp(-height01 * u_densityFalloff) * (1.0 - height01);
  return localDensity;
}
`;

const calculateScattering = `
vec3 calculateScattering(vec3 rayOrigin, vec3 rayDir, float rayLength, vec3 dirToSun, vec3 baseColor) {
  float stepSize = rayLength / (float(u_numInScatteringPoints) - 1.0);
  vec3 inScatteredLight = vec3(0.0);
  float viewRayOpticalDepth = 0.0;

  vec3 inScatterPoint = rayOrigin;
  for (int i = 0; i < u_numInScatteringPoints; i++) {
    float sunRayLength = raySphere(u_earthCenter, u_atmosphereRadius, inScatterPoint, dirToSun)[1];
    float sunRayOpticalDepth = opticalDepth(inScatterPoint, dirToSun, sunRayLength);
    viewRayOpticalDepth = opticalDepth(inScatterPoint, -rayDir, stepSize * float(i)); // validate -rayDir vs rayDir
    vec3 transmittance = exp(-(sunRayOpticalDepth + viewRayOpticalDepth) * u_scatteringCoefficients);
    float localDensity = densityAtPoint(inScatterPoint);

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
}
`;

const applyAtmosphericScatteringSphere = `
vec4 applyAtmosphericScatteringSphere(vec3 rayDir, float sceneDepth, vec3 rayOrigin, vec3 dirToSun, vec4 baseColor) {
  // We get the distance the ray traveled from the eye to the atmosphere and
  // the distance it traveled in the atmosphere to reach the fragment.
  vec2 hitInfo = raySphere(u_earthCenter, u_atmosphereRadius, rayOrigin, rayDir);
  float distanceToAtmosphere = hitInfo[0];
  // We remove distance through atmosphere beyond the fragment's position
  float distanceThroughAtmosphere = min(hitInfo[1], sceneDepth - distanceToAtmosphere);

  float distanceToEarthSurface = raySphere(u_earthCenter, u_earthRadius, rayOrigin, rayDir)[0];
  vec4 temp = distanceToEarthSurface == max_float ? baseColor : vec4(1.0);

  // float tempDiff = length(v_eyeSpace - u_earthCenter) - length(sceneDepth - u_earthCenter);
  // vec4 temp;
  // if (tempDiff >= 0.0 && tempDiff <= 10000.0) {
  //   temp = vec4(0.0, tempDiff / 10000.0, 0.0, 1.0); // GREEN
  // } else if (tempDiff < 0.0 && tempDiff >= -10000.0) {
  //   temp = vec4(tempDiff / -10000.0, 0.0, 0.0, 1.0); // RED
  // } else if (tempDiff < -10000.0) {
  //   temp = vec4(1.0, 0.6, 0.0, 1.0); // ORANGE
  // } else {
  //   temp = vec4(0.0, 0.0, 1.0, 1.0); // BLUE
  // }


  if (distanceThroughAtmosphere > 0.0) {
    // point on ray where atmosphere starts
    vec3 pointInAtmosphere = rayOrigin + rayDir * (distanceToAtmosphere + epsilon);
    vec3 light = calculateScattering(pointInAtmosphere, rayDir, distanceThroughAtmosphere - epsilon * 2.0, dirToSun, baseColor.rgb);
    // return vec4(1.0, baseColor.gba);
    // return vec4(rayDir, 1.0);
    // return vec4(1.0);
    // return vec4(temp, temp, temp, 1.0);
    // return temp;
    return vec4(light, baseColor.a);
  }
  // return vec4(0.0, 0.0, 0.0, 1.0);
  // return vec4(1.0, baseColor.gba);
  // return vec4(rayDir, 1.0);
  // return vec4(temp, temp, temp, 1.0);
  // return temp;
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

  vec3 dirToSun = normalize(u_sunDir);

  // Because we are in view space, the ray's origin is at 0,0,0
  vec3 rayOrigin = vec3(0.0, 0.0, 0.0);

  vec3 rayDir = computeRayDir();
  float sceneDepth = computeSceneDepth();

  if (u_isPlanar == 1)
    return applyAtmosphericScatteringPlanar(rayDir, sceneDepth, rayOrigin, dirToSun, baseColor);
  return applyAtmosphericScatteringSphere(rayDir, sceneDepth, rayOrigin, dirToSun, baseColor);
`;

/** @internal */
export function addAtmosphericScattering(builder: ProgramBuilder, isSky = false, isRealityMesh = false) {
  assert(!(isSky && isRealityMesh));
  const frag = builder.frag;
  frag.addDefine("PI", "3.1415926538");

  frag.addConstant("epsilon", VariableType.Float, `0.000001`);

  frag.addConstant("max_float", VariableType.Float, "3.402823466e+38");
  frag.addConstant("u_maxAtmosphereDistance", VariableType.Float, "10000.0");
  frag.addConstant("ditherStrength", VariableType.Float, "0.1");

  frag.addUniform("u_densityFalloff", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_densityFalloff", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindDensityFalloff(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_isPlanar", VariableType.Int, (prog) => {
    prog.addProgramUniform("u_isPlanar", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindIsPlanar(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_scatteringCoefficients", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_scatteringCoefficients", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindScatteringCoefficients(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_numInScatteringPoints", VariableType.Int, (prog) => {
    prog.addProgramUniform("u_numInScatteringPoints", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindNumInScatteringPoints(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_numOpticalDepthPoints", VariableType.Int, (prog) => {
    prog.addProgramUniform("u_numOpticalDepthPoints", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindNumOpticalDepthPoints(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_sunDir", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_sunDir", (uniform, params) => {
      params.target.uniforms.bindSunDirection(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_viewMatrix", VariableType.Mat3, (prog) => {
    prog.addProgramUniform("u_viewMatrix", (uniform, params) => {
      uniform.setMatrix3(Matrix3.fromMatrix3d(params.target.uniforms.frustum.viewMatrix.matrix));
    });
  }, VariablePrecision.High);

  frag.addUniform("u_earthCenter", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_earthCenter", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindEarthCenter(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_atmosphereRadius", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_atmosphereRadius", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindAtmosphereRadius(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_earthRadius", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_earthRadius", (uniform, params) => {
      params.target.uniforms.atmosphericScattering.bindEarthRadius(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_vpSize", VariableType.Vec2, (prog) => {
    prog.addProgramUniform("u_vpSize", (uniform, params) => {
      params.target.uniforms.viewRect.bindDimensions(uniform);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_isEnabled", VariableType.Int, (prog) => {
    prog.addProgramUniform("u_isEnabled", (uniform, params) => {
      uniform.setUniform1i(params.target.plan.viewFlags.atmosphericScattering?1:0);
    });
  }, VariablePrecision.High);

  frag.addFunction(raySphere);
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

  if (isSky) {
    frag.addFunction(computeRayDirSky);
    frag.addFunction(computeSceneDepthSky);
  } else if (isRealityMesh) {
    frag.addFunction(computeRayDirDefault);
    frag.addFunction(computeSceneDepthRealityMesh);
  } else {
    frag.addFunction(computeRayDirDefault);
    frag.addFunction(computeSceneDepthDefault);
  }

  addEyeSpace(builder);
  frag.set(FragmentShaderComponent.ApplyAtmosphericScattering, applyAtmosphericScattering);
}
// #endregion MAIN

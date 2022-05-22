/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { Angle, Vector3d } from "@itwin/core-geometry";
import { Cartographic } from "./geometry/Cartographic";

// cspell:ignore mrad sinm sint aarg

// Code below loosely translated from  https://www.esrl.noaa.gov/gmd/grad/solcalc/
function calcTimeJulianCent(jd: number) {
  const T = (jd - 2451545.0) / 36525.0;
  return T;
}

function radToDeg(angleRad: number) {
  return (180.0 * angleRad / Math.PI);
}

function degToRad(angleDeg: number) {
  return (Math.PI * angleDeg / 180.0);
}

function calcGeomMeanLongSun(t: number) {
  let L0 = 280.46646 + t * (36000.76983 + t * (0.0003032));
  while (L0 > 360.0) {
    L0 -= 360.0;
  }
  while (L0 < 0.0) {
    L0 += 360.0;
  }
  return L0;		// in degrees
}

function calcGeomMeanAnomalySun(t: number) {
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  return M;		// in degrees
}

function calcEccentricityEarthOrbit(t: number) {
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  return e;		// unitless
}

function calcSunEqOfCenter(t: number) {
  const m = calcGeomMeanAnomalySun(t);
  const mrad = degToRad(m);
  const sinm = Math.sin(mrad);
  const sin2m = Math.sin(mrad + mrad);
  const sin3m = Math.sin(mrad + mrad + mrad);
  const C = sinm * (1.914602 - t * (0.004817 + 0.000014 * t)) + sin2m * (0.019993 - 0.000101 * t) + sin3m * 0.000289;
  return C;		// in degrees
}

function calcSunTrueLong(t: number) {
  const l0 = calcGeomMeanLongSun(t);
  const c = calcSunEqOfCenter(t);
  const O = l0 + c;
  return O;		// in degrees
}

function calcSunApparentLong(t: number) {
  const o = calcSunTrueLong(t);
  const omega = 125.04 - 1934.136 * t;
  const lambda = o - 0.00569 - 0.00478 * Math.sin(degToRad(omega));
  return lambda;		// in degrees
}

function calcMeanObliquityOfEcliptic(t: number) {
  const seconds = 21.448 - t * (46.8150 + t * (0.00059 - t * (0.001813)));
  const e0 = 23.0 + (26.0 + (seconds / 60.0)) / 60.0;
  return e0;		// in degrees
}

function calcObliquityCorrection(t: number) {
  const e0 = calcMeanObliquityOfEcliptic(t);
  const omega = 125.04 - 1934.136 * t;
  const e = e0 + 0.00256 * Math.cos(degToRad(omega));
  return e;		// in degrees
}

function calcSunDeclination(t: number) {
  const e = calcObliquityCorrection(t);
  const lambda = calcSunApparentLong(t);

  const sint = Math.sin(degToRad(e)) * Math.sin(degToRad(lambda));
  const theta = radToDeg(Math.asin(sint));
  return theta;		// in degrees
}

function calcEquationOfTime(t: number) {
  const epsilon = calcObliquityCorrection(t);
  const l0 = calcGeomMeanLongSun(t);
  const e = calcEccentricityEarthOrbit(t);
  const m = calcGeomMeanAnomalySun(t);

  let y = Math.tan(degToRad(epsilon) / 2.0);
  y *= y;

  const sin2l0 = Math.sin(2.0 * degToRad(l0));
  const sinm = Math.sin(degToRad(m));
  const cos2l0 = Math.cos(2.0 * degToRad(l0));
  const sin4l0 = Math.sin(4.0 * degToRad(l0));
  const sin2m = Math.sin(2.0 * degToRad(m));

  const eTime = y * sin2l0 - 2.0 * e * sinm + 4.0 * e * y * sinm * cos2l0 - 0.5 * y * y * sin4l0 - 1.25 * e * e * sin2m;
  return radToDeg(eTime) * 4.0;	// in minutes of time
}

function calcAzEl(t: number, localTime: number, latitude: number, longitude: number, zone: number): { azimuth: number, elevation: number } {
  const eqTime = calcEquationOfTime(t);
  const theta = calcSunDeclination(t);
  const solarTimeFix = eqTime + 4.0 * longitude - 60.0 * zone;
  let trueSolarTime = localTime + solarTimeFix;
  while (trueSolarTime > 1440)
    trueSolarTime -= 1440;

  let hourAngle = trueSolarTime / 4.0 - 180.0;
  if (hourAngle < -180) {
    hourAngle += 360.0;
  }
  const haRad = degToRad(hourAngle);
  let csz = Math.sin(degToRad(latitude)) * Math.sin(degToRad(theta)) + Math.cos(degToRad(latitude)) * Math.cos(degToRad(theta)) * Math.cos(haRad);
  if (csz > 1.0) {
    csz = 1.0;
  } else if (csz < -1.0) {
    csz = -1.0;
  }
  const zenith = radToDeg(Math.acos(csz));
  const azDenom = (Math.cos(degToRad(latitude)) * Math.sin(degToRad(zenith)));
  let azimuth;
  if (Math.abs(azDenom) > 0.001) {
    let azRad = ((Math.sin(degToRad(latitude)) * Math.cos(degToRad(zenith))) - Math.sin(degToRad(theta))) / azDenom;
    if (Math.abs(azRad) > 1.0) {
      if (azRad < 0) {
        azRad = -1.0;
      } else {
        azRad = 1.0;
      }
    }
    azimuth = 180.0 - radToDeg(Math.acos(azRad));
    if (hourAngle > 0.0) {
      azimuth = -azimuth;
    }
  } else {
    if (latitude > 0.0) {
      azimuth = 180.0;
    } else {
      azimuth = 0.0;
    }
  }
  if (azimuth < 0.0) {
    azimuth += 360.0;
  }
  return { azimuth, elevation: 90 - zenith };
}

function calculateJulianDay(date: Date) {
  return Math.floor(date.getTime() / 86400000) + 2440587.5;    // https://stackoverflow.com/questions/11759992/calculating-jdayjulian-day-in-javascript
}

/** @public
 * calculate solar angles (in radians) based at a given date/time and cartographic location.
 */
export function calculateSolarAngles(date: Date, location: Cartographic): { azimuth: number, elevation: number } {
  const jDay = calculateJulianDay(date);
  const latitude = location.latitudeDegrees;
  const longitude = location.longitudeDegrees;
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const zone = Math.floor(.5 + longitude / 15.0); // date.getTimeZoneOffset mixes in DST.
  const localMinutes = utcMinutes + zone * 60;
  const jTotal = jDay + utcMinutes / 1440.0;
  const T = calcTimeJulianCent(jTotal);
  return calcAzEl(T, localMinutes, latitude, longitude, zone);
}

/** @public
 * calculate solar direction based at a given date/time and cartpgrphic location.
 */
export function calculateSolarDirection(date: Date, location: Cartographic): Vector3d {
  return calculateSolarDirectionFromAngles(calculateSolarAngles(date, location));
}

/** @public
 * calculate solar direction corresponding to the given azimuth and elevation (altitude) angles in degrees.
 */
export function calculateSolarDirectionFromAngles(azimuthElevation: { azimuth: number, elevation: number }): Vector3d {
  const azimuth = Angle.degreesToRadians(azimuthElevation.azimuth);
  const elevation = Angle.degreesToRadians(azimuthElevation.elevation);
  const cosElevation = Math.cos(elevation);
  const sinElevation = Math.sin(elevation);
  return Vector3d.create(-Math.sin(azimuth) * cosElevation, -Math.cos(azimuth) * cosElevation, -sinElevation);
}

function dateFromUtcMinutes(date: Date, utcMinutes: number) {
  const utcHours = Math.floor(utcMinutes / 60.0);
  const output = new Date(date);
  output.setUTCHours(utcHours);
  output.setUTCMinutes(Math.floor(.5 + utcMinutes - 60.0 * utcHours));
  output.setUTCSeconds(0);
  return output;
}

function calcSunriseUtcMinutes(rise: boolean, lat: number, longitude: number, jDay: number) {
  const t = calcTimeJulianCent(jDay);
  const eqTime = calcEquationOfTime(t);
  const solarDec = calcSunDeclination(t);
  const latRad = degToRad(lat);
  const sdRad = degToRad(solarDec);
  const hAarg = (Math.cos(degToRad(90.833)) / (Math.cos(latRad) * Math.cos(sdRad)) - Math.tan(latRad) * Math.tan(sdRad));
  const hourAngle = Math.acos(hAarg);
  const delta = longitude + radToDeg(rise ? hourAngle : - hourAngle);
  return 720 - (4.0 * delta) - eqTime;	// in UTC minutes
}

/** @public
 * calculate solar sunrise or sunset for a given day and cartographic location.
 */
export function calculateSunriseOrSunset(date: Date, location: Cartographic, sunrise: boolean): Date {
  const jDay = calculateJulianDay(date);
  const longitude = location.longitudeDegrees;
  const latitude = location.latitudeDegrees;
  const utcMinutes = calcSunriseUtcMinutes(sunrise, latitude, longitude, jDay);
  return sunrise ? dateFromUtcMinutes(date, utcMinutes) : dateFromUtcMinutes(date, calcSunriseUtcMinutes(sunrise, latitude, longitude, jDay + utcMinutes / 1440));
}

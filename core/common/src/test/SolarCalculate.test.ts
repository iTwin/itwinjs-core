/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Cartographic } from "../geometry/Cartographic";
import { calculateSolarAngles, calculateSunriseOrSunset } from "../SolarCalculate";

function testSolarAngleCalculation(location: Cartographic, dateString: string, expectedAzimuth: number, expectedElevation: number, expectedSunriseString?: string, expectedSunsetString?: string) {
  const date = new Date(dateString);
  const azEl = calculateSolarAngles(date, location);
  assert(Math.abs(azEl.azimuth - expectedAzimuth) < .05 && Math.abs(azEl.elevation - expectedElevation) < .05);
  if (expectedSunriseString) {
    const expectedSunrise = new Date(expectedSunriseString);
    const sunrise = calculateSunriseOrSunset(date, location, true);
    const et = expectedSunrise.getTime(), t = sunrise.getTime();
    assert(Math.abs(et - t) < 61 * 1000);
  }
  if (expectedSunsetString) {
    const expectedSunset = new Date(expectedSunsetString);
    const sunset = calculateSunriseOrSunset(date, location, false);
    const et = expectedSunset.getTime(), t = sunset.getTime();
    assert(Math.abs(et - t) < 61 * 1000);
  }
}

describe("Solar Calculations", () => {

  it("should compare as expected", () => {
    const philadelphia = Cartographic.fromDegrees({ longitude: -75.17035, latitude: 39.954927, height: 0.0 });
    testSolarAngleCalculation(philadelphia, "May 03 2019 12:00:00 GMT -0500", 181.42, 65.78, "May 03 2019 04:59 GMT -0500", "May 03 2019 18:57 GMT -0500");
    testSolarAngleCalculation(philadelphia, "Sep 03 2019 12:00:00 GMT -0500", 179.96, 57.53, "Sep 03 2019 05:30 GMT -0500", "Sep 03 2019 18:29 GMT -0500");
    testSolarAngleCalculation(philadelphia, "Feb 03 2019 12:00:00 GMT -0500", 175.84, 33.51, "Feb 03 2019 07:07 GMT -0500", "Feb 03 2019 17:22 GMT -0500");
    const algeria = Cartographic.fromDegrees({ longitude: 2.54882812, latitude: 27.761329, height: 0.0 });
    testSolarAngleCalculation(algeria, "May 03 2019 12:00:00 GMT -0000", 194.96, 77.53);
    testSolarAngleCalculation(algeria, "Sep 03 2019 12:00:00 GMT -0000", 187.66, 69.64);
    testSolarAngleCalculation(algeria, "Feb 03 2019 12:00:00 GMT -0000", 178.76, 45.72);
    const melbourne = Cartographic.fromDegrees({ longitude: 145.371093, latitude: -37.8575, height: 0.0 });
    testSolarAngleCalculation(melbourne, "May 03 2019 12:00:00 GMT +1000", 4.64, 36.49, "May 03 2019 7:01 GMT +1000 ", "May 03 2019 17:30 GMT +1000");
    testSolarAngleCalculation(melbourne, "Sep 03 2019 12:00:00 GMT +1000", 6.27, 44.26, "Sep 03 2019 6:38 GMT +1000 ", "Sep 03 2019 17:58 GMT +1000");
    testSolarAngleCalculation(melbourne, "Feb 03 2019 12:00:00 GMT +1000", 20.69, 67.6, "Feb 03 2019 5:34 GMT +1000 ", "Feb 03 2019 19:30 GMT +1000");
  });
});

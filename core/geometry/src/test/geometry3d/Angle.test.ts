/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";

import { Arc3d } from "../../curve/Arc3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { AngleSweepProps, Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* cspell:word isnan */

class AngleTests {
  constructor(public noisy: boolean = false) { }

  public testAlmostEqual(ck: Checker) {
    const a = 0.5 * Geometry.smallAngleRadians;
    const b = 8.0 * Geometry.smallAngleRadians;
    const c = 1.0;    // radians, a nonzero angle
    const degreeCandidates = [0, 2, 56, 89, 90, 180];
    const periodCandidates = [0, 1, -1, 4, -6];
    let shiftPeriod = 0;
    let degrees = 0;
    for (shiftPeriod of periodCandidates) {
      const shift = shiftPeriod * 360;
      for (degrees of degreeCandidates) {
        const theta0 = Angle.createDegrees(degrees);
        const theta0A = Angle.createDegrees(213123);
        ck.testFalse(theta0.isAlmostEqualNoPeriodShift(theta0A));
        theta0A.setDegrees(theta0.degrees);
        ck.testTrue(theta0.isAlmostEqualNoPeriodShift(theta0A));

        const theta1 = Angle.createDegrees(degrees + shift);
        ck.testBoolean(true, theta0.isAlmostEqualAllowPeriodShift(theta1), "exact shift");

        ck.testBoolean(true, theta0.isAlmostEqualAllowPeriodShift(Angle.createRadians(theta1.radians + a)), "Small positive shift");
        ck.testBoolean(true, theta0.isAlmostEqualAllowPeriodShift(Angle.createRadians(theta1.radians - a)), "Small negative shift");

        ck.testBoolean(false, theta0.isAlmostEqualAllowPeriodShift(Angle.createRadians(theta1.radians + b)), "medium positive shift");
        ck.testBoolean(false, theta0.isAlmostEqualAllowPeriodShift(Angle.createRadians(theta1.radians - b)), "medium negative shift");

        ck.testBoolean(false, theta0.isAlmostEqualAllowPeriodShift(Angle.createRadians(theta1.radians + c)), "large positive shift");
        ck.testBoolean(false, theta0.isAlmostEqualAllowPeriodShift(Angle.createRadians(theta1.radians - c)), "large negative shift");
      }
    }
  }

  public testAdjust(ck: Checker) {
    const degreeCandidates = [0, 2, 56, 179, 180, 181];
    const periodCandidates = [0, 1, -1, 4, -6];
    let shiftPeriod = 0;
    let degreeOffset;
    for (shiftPeriod of periodCandidates) {
      const shift = shiftPeriod * 360;
      for (degreeOffset of degreeCandidates) {
        const degrees = shift + degreeOffset;
        const theta0 = Angle.createDegrees(degrees);
        const theta1 = Angle.createDegreesAdjustPositive(degrees);
        const theta2 = Angle.createDegreesAdjustSigned180(degrees);
        if (this.noisy)
          GeometryCoreTestIO.consoleLog(
            "adjust angle:", theta0.degrees,
            "    positive:", theta1.degrees,
            "    signed:", theta2.degrees,
          );
        ck.testBoolean(true, theta0.isAlmostEqualAllowPeriodShift(theta1), "adjust positive");
        ck.testBoolean(true, theta0.isAlmostEqualAllowPeriodShift(theta2), "adjust signed");
      }
    }
  }

  public testFractions(sweep: AngleSweep, ck: Checker) {
    const reverseSweep = sweep.clone();
    reverseSweep.reverseInPlace();
    const sweep2 = AngleSweep.createStartEndDegrees(1000, -21312); // gibberish sweep (hopeful unequal to any supplied sweep)
    sweep2.setFrom(sweep);
    ck.testTrue(sweep.isAlmostEqualAllowPeriodShift(sweep2));
    ck.testBoolean(sweep.isCCW, !reverseSweep.isCCW, "reversal flips ccw");
    ck.testFalse(sweep.isAlmostEqualNoPeriodShift(reverseSweep));

    const fractionCandidates = [0, 0.25, 0.5, 0.75, 1.0, -0.3, 1.3, -10, 10];
    const fractionPeriod = sweep.fractionPeriod();
    let f0 = 0;
    for (f0 of fractionCandidates) {
      const theta0 = sweep.fractionToAngle(f0);
      ck.testAngleNoShift(theta0, reverseSweep.fractionToAngle(1.0 - f0));

      const f1 = sweep.angleToUnboundedFraction(theta0);
      ck.testCoordinate(f0, f1, "unbounded fraction round trip");

      const f2 = sweep.angleToPositivePeriodicFraction(theta0);
      const theta2 = sweep.fractionToAngle(f2);
      ck.testAngleAllowShift(theta0, theta2, "angleToPositivePeriodicFraction");

      const f3 = sweep.angleToSignedPeriodicFraction(theta0);
      const theta3 = sweep.fractionToAngle(f3);
      ck.testAngleAllowShift(theta0, theta3, "angleToSignedPeriodicFraction");

      const inside = sweep.isAngleInSweep(theta0);
      ck.testBoolean(inside, f2 <= 1.0, "isAngleInSweep agrees with positivePeriodicFraction");

      ck.testAngleAllowShift(
        sweep.fractionToAngle(f0),
        sweep.fractionToAngle(f0 + fractionPeriod),
        "fractionPeriod steps 360",
      );
      ck.testAngleAllowShift(
        sweep.fractionToAngle(f0),
        sweep.fractionToAngle(f0 - fractionPeriod),
        "fractionPeriod steps 360",
      );
    }
  }
}

describe("Angle.AlmostEqual", () => {
  it("Verify angle tolerance tests", () => {
    const ck = new Checker();
    const source = new AngleTests(false);
    source.testAlmostEqual(ck);
    ck.testTrue(Angle.createDegrees(0).isExactZero);
    ck.testTrue(Angle.createRadians(0).isExactZero);
    ck.testFalse(Angle.createRadians(1.0e-20).isExactZero);

    ck.checkpoint("End Angle.AlmostEqual");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Angle.Adjust", () => {
  it("Verify angle period adjustments tests", () => {
    const ck = new Checker();
    const source = new AngleTests(false);
    source.testAdjust(ck);

    ck.checkpoint("End Angle.Adjust");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Trig", () => {
    const ck = new Checker();
    for (const radians of [-1, 0, 1, 2]) {
      const theta = Angle.createRadians(radians);
      ck.testCoordinate(theta.cos(), Math.cos(radians));
      ck.testCoordinate(theta.sin(), Math.sin(radians));
      ck.testCoordinate(theta.tan(), Math.tan(radians));
      ck.testFalse(theta.isFullCircle);
    }

    ck.checkpoint("Angle.Trig");
    expect(ck.getNumErrors()).equals(0);
  });
});

function testSweep(ck: Checker, sweep: AngleSweep, isCCW: boolean, isFullCircle: boolean, sweepDegrees: number | undefined) {
  ck.testBoolean(sweep.isCCW, isCCW, "sweep.isCCW");
  ck.testBoolean(sweep.isFullCircle, isFullCircle, "sweep.isFullCircle");
  if (sweepDegrees !== undefined)
    ck.testCoordinate(sweep.sweepDegrees, sweepDegrees, "sweep.sweepDegrees");
}

describe("AngleSweep", () => {
  it("Fractions", () => {
    const ck = new Checker();
    const source = new AngleTests(false);
    source.testFractions(AngleSweep.createStartSweepDegrees(0, 90), ck);
    source.testFractions(AngleSweep.createStartSweepRadians(-1, 1), ck);
    source.testFractions(AngleSweep.createStartSweepRadians(1, -2), ck);
    source.testFractions(AngleSweep.createStartSweep(Angle.createRadians(0), Angle.createDegrees(360)), ck);

    ck.checkpoint("AngleSweeps.TestFractions");
    expect(ck.getNumErrors()).equals(0);
  }),
    it("Caps", () => {
      const ck = new Checker();
      const sweep = AngleSweep.createStartEndDegrees(-100, 200);
      ck.testLT(180, sweep.sweepDegrees);
      testSweep(ck, sweep, true, false, 300);
      sweep.capLatitudeInPlace();
      testSweep(ck, sweep, true, false, 180);

      const smallSweep = AngleSweep.createStartEndDegrees(-10, 30);
      const smallSweep1 = smallSweep.clone();
      testSweep(ck, smallSweep1, true, false, 40);
      smallSweep.capLatitudeInPlace();
      testSweep(ck, smallSweep1, true, false, 40);

      const negativeSweep = AngleSweep.createStartEndDegrees(100, -100);
      testSweep(ck, negativeSweep, false, false, -200);
      negativeSweep.capLatitudeInPlace();
      testSweep(ck, negativeSweep, false, false, -180);

      ck.checkpoint("AngleSweeps.Caps");
      expect(ck.getNumErrors()).equals(0);
    }),
    it("Hello", () => {
      const ck = new Checker();
      const theta0 = Angle.createDegrees(10);
      const dTheta = Angle.createDegrees(120);
      const theta1 = Angle.createDegrees(theta0.degrees + dTheta.degrees);
      const sweep = AngleSweep.createStartSweep(theta0, dTheta);
      const sweep1 = AngleSweep.createStartEnd(theta0, theta1);
      ck.testCoordinate(sweep.startAngle.degrees, theta0.degrees);
      ck.testCoordinate(sweep.endAngle.degrees, theta0.degrees + dTheta.degrees);
      ck.testTrue(sweep.isAlmostEqualNoPeriodShift(sweep1));

      ck.checkpoint("AngleSweeps.Hello");
      expect(ck.getNumErrors()).equals(0);
    });
});

describe("SmallNumbers", () => {
  it("SmallNumbers", () => {
    const ck = new Checker();
    ck.testTrue(Geometry.isSmallAngleRadians(0.0));
    ck.testTrue(Geometry.isSmallAngleRadians(1.0e-14));
    ck.testTrue(Geometry.isSmallAngleRadians(-1.0e-14));
    ck.testFalse(Geometry.isSmallAngleRadians(1.0e-10));
    ck.testFalse(Geometry.isSmallAngleRadians(-1.0e-10));
    ck.testTrue(Geometry.isDistanceWithinTol(1.0, 2.0));
    ck.testTrue(Geometry.isDistanceWithinTol(-1.0, 2.0));
    ck.testFalse(Geometry.isDistanceWithinTol(4.0, 2.0));
    ck.testFalse(Geometry.isDistanceWithinTol(-4.0, 2.0));
    ck.testTrue(Geometry.isDistanceWithinTol(1.0e-8));

    for (let x = 1.e-15; x < 0.001; x *= 10.0) {
      ck.testTrue(Geometry.isSmallMetricDistance(x) === Geometry.isSmallMetricDistanceSquared(x * x));
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("MiscAngles", () => {
  it("orientedAngleBetweenVectorsXYZ", () => {
    const ck = new Checker();
    for (const degrees of [179, 181, 0, 45, 90, 130, 179, 181, 270, 359, -10, -45, -90, -100, -179]) {
      const theta = Angle.createDegrees(degrees);
      const vectorU = Vector3d.create(1, 0, 0);
      const vectorV = Vector3d.create(theta.cos(), theta.sin(), 0);
      const vectorW = Vector3d.create(0, 0, 1);
      const radians = Angle.degreesToRadians(degrees);
      const radiansPositive = radians > 0 ? radians : Angle.adjustRadians0To2Pi(radians);
      const alphaTrue = Angle.orientedRadiansBetweenVectorsXYZ(
        vectorU.x, vectorU.y, vectorU.z,
        vectorV.x, vectorV.y, vectorV.z,
        vectorW.x, vectorW.y, vectorW.z,
        true,
      );
      const alphaFalse = Angle.orientedRadiansBetweenVectorsXYZ(
        vectorU.x, vectorU.y, vectorU.z,
        vectorV.x, vectorV.y, vectorV.z,
        vectorW.x, vectorW.y, vectorW.z,
        false,
      );
      ck.testCoordinate(alphaTrue, radiansPositive, { degrees, adjust: true });
      ck.testCoordinate(alphaFalse, degrees <= 180.0 ? radians : Angle.adjustRadiansMinusPiPlusPi(radians), { degrees, adjust: false });
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("InverseInterpolate", () => {
    const ck = new Checker();
    const xA = 3.5;
    const xB = 5.1;
    const yA = -2.0;
    const yB = 1.2;
    for (const fraction of [-2, 0.2, 0.8, 1.0, 2.0]) {
      const y = Geometry.interpolate(yA, fraction, yB);
      const x = Geometry.interpolate(xA, fraction, xB);

      const fractionX = Geometry.inverseInterpolate01(xA, xB, x);
      if (!!fractionX) {
        ck.testCoordinate(fraction, fractionX, "inverse interpolate 01 for x");
      }

      const fractionY = Geometry.inverseInterpolate01(yA, yB, y);
      if (!!fractionY) {
        ck.testCoordinate(fraction, fractionY, "inverse interpolate 01 for y");
      }

      const xx = Geometry.inverseInterpolate(xA, yA, xB, yB, y);
      if (!!xx) {
        ck.testCoordinate(x, xx, "inverse interpolate");
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("DegreesRoundTrip", () => {
    const ck = new Checker();
    const errorRangeB = Range1d.createX(0.0);
    const errorRangeC = Range1d.createX(0.0);
    for (let degreesA = 1.0; degreesA <= 400.0; degreesA += 1.0) {
      const angle = Angle.createDegrees(degreesA);
      const degreesB = angle.degrees;
      const eB = (degreesB - degreesA) / degreesA;
      const radiansA = Angle.degreesToRadians(degreesA);
      const degreesC = Angle.radiansToDegrees(radiansA);
      const eC = (degreesC - degreesA) / degreesA;
      if (eB !== 0.0)
        errorRangeB.extendX(eB);
      if (eC !== 0.0)
        errorRangeC.extendX(eC);
    }
    ck.testLT(errorRangeB.maxAbs(), 1.0e-15, " degrees round trip error range through Angle logic");
    ck.testLT(errorRangeC.maxAbs(), 1.0e-15, " degrees round trip error range through direct multiply");
    expect(ck.getNumErrors()).equals(0);
  });

  it("DegreesAdjusts", () => {
    const ck = new Checker();
    for (const factor of [5, -1, 5, -5, 10, -10])
      for (const degreesA of [190, 0, 1, 10, 30, 110, 110, 170]) {
        const degrees = factor * degreesA;
        const angleA = Angle.createDegrees(degrees);
        const angleB = Angle.createDegreesAdjustPositive(degrees);
        const angleC = Angle.createDegreesAdjustSigned180(degrees);
        ck.testTrue(angleA.isAlmostEqualAllowPeriodShift(angleB), degrees, "adjust03600 wrap");
        ck.testTrue(angleA.isAlmostEqualAllowPeriodShift(angleC), degrees, "adjustSigned180 wrap");
        ck.testLE(Math.abs(angleB.degrees - 180), 180.0, degrees, "adjust 0360 bounds");
        ck.testLE(Math.abs(angleC.degrees), 180.0, degrees, "adjust signed180 bounds");
        ck.testCoordinate(
          angleB.radians,
          Angle.adjustRadians0To2Pi(Angle.degreesToRadians(degrees)),
          "adjustRadians0To2Pi",
          degrees,
        );
        ck.testCoordinate(
          angleC.radians,
          Angle.adjustRadiansMinusPiPlusPi(Angle.degreesToRadians(degrees)),
          "adjustRadiansMinusPiPlusPi",
          degrees,
        );
      }
    expect(ck.getNumErrors()).equals(0);
  });

  it("defaults", () => {
    const ck = new Checker();
    const r10 = Angle.degreesToRadians(10);
    const full0 = AngleSweep.create360(); // (0,360)
    const full10 = AngleSweep.create360(r10); // (10,370)
    ck.testCoordinate(full10.sweepDegrees, full0.sweepDegrees);

    const fullRadiansA = AngleSweep.createStartEndRadians();
    const fullDegreesA = AngleSweep.createStartEndDegrees();
    ck.testTrue(fullRadiansA.isAlmostEqualNoPeriodShift(fullDegreesA), "radians, degrees defaults", fullRadiansA, fullDegreesA);
    ck.testCoordinate(360, fullRadiansA.sweepDegrees);

    const sweepB = AngleSweep.create360();
    const sweepC = AngleSweep.createStartEndRadians(0, 1, sweepB);
    ck.testFalse(sweepB.isFullCircle);
    ck.testTrue(sweepC === sweepB);

    const sweepE = AngleSweep.createStartSweepDegrees(10, 23);
    ck.testFalse(sweepE.isAlmostEqualNoPeriodShift(fullRadiansA));
    sweepE.setStartEndDegrees(); // full circle default
    ck.testTrue(sweepE.isAlmostEqualAllowPeriodShift(fullDegreesA));
    const sweepF = AngleSweep.createStartSweepDegrees();
    ck.testTrue(sweepF.isAlmostEqualAllowPeriodShift(fullDegreesA));

    for (const sign of [-1, 1]) {
      ck.testFalse(Angle.createDegrees(sign * 90).isHalfCircle);
      ck.testFalse(Angle.createDegrees(sign * 45).isHalfCircle);
      ck.testTrue(Angle.createDegrees(sign * 180).isHalfCircle);
      for (const e of [1.0e-8, -1.0e-8]) {
        ck.testFalse(Angle.createDegrees(sign * 180 + e).isHalfCircle);
      }
    }

    let maxDeltaStepADegrees = 0;
    let maxDeltaStepBRadians = 0;
    for (const baseDegrees of [0, 45, 60, 90, 270, 10]) {
      const angleA = Angle.createDegrees(baseDegrees);
      const baseRadians = Angle.degreesToRadians(baseDegrees);
      const angleB = Angle.createRadians(Angle.degreesToRadians(baseDegrees));
      let totalMultiple = 0;
      for (const incrementalMultiple of [0, 1, 2, -1, -2, 5, 10]) {
        totalMultiple += incrementalMultiple;
        angleA.addMultipleOf2PiInPlace(incrementalMultiple);
        angleB.addMultipleOf2PiInPlace(incrementalMultiple);
        const stepADegrees = angleA.degrees - baseDegrees;
        const deltaStepADegrees = stepADegrees - totalMultiple * 360;
        const stepBRadians = angleB.radians - baseRadians;
        const deltaStepBRadians = stepBRadians - totalMultiple * 2.0 * Math.PI;
        maxDeltaStepADegrees = Math.max(maxDeltaStepADegrees, Math.abs(deltaStepADegrees));
        maxDeltaStepBRadians = Math.max(maxDeltaStepBRadians, Math.abs(deltaStepBRadians));
      }
    }
    ck.testTrue(0 === maxDeltaStepADegrees, "degree shifts are exact");
    ck.testFalse(0 === maxDeltaStepBRadians, "radians shifts are not exact");

    GeometryCoreTestIO.consoleLog({
      maxErrDegrees: maxDeltaStepADegrees,
      maxErrRadians: maxDeltaStepBRadians,
      maxErrRadiansConvertedToDegrees: Angle.radiansToDegrees(maxDeltaStepBRadians),
    });

    const f = Angle.createDegrees(10);
    f.freeze();
    assert.throws(() => f.setDegrees(20));

    expect(ck.getNumErrors()).equals(0);
  });

  it("SmallSweep", () => {
    const ck = new Checker();
    const defaultFraction = 3;
    const sweep = AngleSweep.createStartEndRadians(0.14859042783429374, 0.14859042783429377);
    const f = sweep.radiansToPositivePeriodicFraction(3.2901830814240864, defaultFraction);
    ck.testCoordinate(f, defaultFraction);
    expect(ck.getNumErrors()).equals(0);
  });

  it("Angle.toJson", () => {
    const ck = new Checker();
    for (const factor of [5, -1, 5, -5, 10, -10])
      for (const degreesA of [190, 0, 1, 10, 30, 110, 110, 170]) {
        const thetaA = Angle.createDegrees(factor * degreesA);
        const jsonB = thetaA.toJSON();
        const jsonC = thetaA.toJSONRadians();
        const thetaB = Angle.fromJSON(jsonB);
        const thetaC = Angle.fromJSON(jsonC);
        ck.testAngleNoShift(thetaA, thetaB);
        ck.testAngleNoShift(thetaA, thetaC);
      }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Angle.fromJSON", () => {
    const ck = new Checker();
    for (const degrees of [10, 0, 45, -20]) {
      const angleA = Angle.createDegrees(degrees);
      const angleB = Angle.fromJSON({ degrees: angleA.degrees });
      ck.testTrue(angleA.isAlmostEqualNoPeriodShift(angleB));
      const angleC = Angle.fromJSON({ radians: angleA.radians });
      ck.testTrue(angleA.isAlmostEqualNoPeriodShift(angleC));
      const angleD = Angle.fromJSON(angleB);
      ck.testTrue(angleA.isAlmostEqualNoPeriodShift(angleD));
      const angleZ = Angle.fromJSON(undefined);
      ck.testCoordinate(angleZ.degrees, 0);
      const angleRa = Angle.fromJSON({ _radians: angleA.radians }); // eslint-disable-line @typescript-eslint/naming-convention
      const angleDe = Angle.fromJSON({ _degrees: angleA.degrees }); // eslint-disable-line @typescript-eslint/naming-convention
      ck.testAngleNoShift(angleA, angleRa);
      ck.testAngleNoShift(angleA, angleDe);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Angle.fromJSON", () => {
    const ck = new Checker();
    ck.testFalse(Number.NaN > 0, "NaN > 0"); // eslint-disable-line use-isnan
    ck.testFalse(Number.NaN < 0, "NaN < 0"); // eslint-disable-line use-isnan
    ck.testFalse(Number.NaN === 0, "NaN === 0"); // eslint-disable-line use-isnan

    ck.testExactNumber(0, Angle.adjustDegrees0To360(Number.NaN));
    ck.testExactNumber(0, Angle.adjustDegreesSigned180(Number.NaN));
    ck.testExactNumber(0, Angle.adjustRadians0To2Pi(Number.NaN));
    ck.testExactNumber(0, Angle.adjustRadiansMinusPiPlusPi(Number.NaN));

    ck.testExactNumber(0, Angle.adjustDegrees0To360((undefined as unknown) as number));
    ck.testExactNumber(0, Angle.adjustDegreesSigned180((undefined as unknown) as number));
    ck.testExactNumber(0, Angle.adjustRadians0To2Pi((undefined as unknown) as number));
    ck.testExactNumber(0, Angle.adjustRadiansMinusPiPlusPi((undefined as unknown) as number));

    expect(ck.getNumErrors()).equals(0);
  });

  it("AngleSweep.fromJSON", () => {
    const ck = new Checker();
    const sweepA = AngleSweep.createStartEndDegrees(10, 50);
    const sweepB = AngleSweep.fromJSON({ degrees: [sweepA.startDegrees, sweepA.endDegrees] });
    ck.testTrue(sweepA.isAlmostEqualNoPeriodShift(sweepB));
    const sweepC = AngleSweep.fromJSON({ radians: [sweepA.startRadians, sweepA.endRadians] });
    ck.testTrue(sweepA.isAlmostEqualNoPeriodShift(sweepC));
    const sweepD = AngleSweep.fromJSON(sweepB);
    ck.testTrue(sweepA.isAlmostEqualNoPeriodShift(sweepD));
    const sweepZ = AngleSweep.fromJSON(undefined);
    ck.testTrue(sweepZ.isFullCircle);
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Angle.fromJson", () => {
  it("Angle.fromJsonUndefined", () => {
    const output: AngleSweep = AngleSweep.fromJSON();
    const expected: AngleSweep = AngleSweep.create360();
    assert.isOk(output.isAlmostEqual(expected));
  }),
    it("Angle.fromJsonUndefined", () => {
      const startAngle: number = Math.PI / 6;
      const endAngle: number = Math.PI / 3;
      const json: AngleSweep = AngleSweep.createStartEndRadians(startAngle, endAngle);
      const output: AngleSweep = AngleSweep.fromJSON(json);
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.startAngle.radians, startAngle));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.endAngle.radians, endAngle));
    }),
    it("Angle.fromJson", () => {
      const startAngleInDegrees: number = 30;
      const endAngleInDegrees: number = 60;
      const startAngleInRadians: number = Math.PI / 6;
      const endAngleInRadians: number = Math.PI / 3;
      const json: AngleSweepProps = [startAngleInDegrees, endAngleInDegrees];
      const output: AngleSweep = AngleSweep.fromJSON(json);
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.startAngle.radians, startAngleInRadians));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.endAngle.radians, endAngleInRadians));
    }),
    it("Angle.fromJsonDegrees", () => {
      const startAngleInDegrees: number = 30;
      const endAngleInDegrees: number = 60;
      const startAngleInRadians: number = Math.PI / 6;
      const endAngleInRadians: number = Math.PI / 3;
      const json: AngleSweepProps = { degrees: [startAngleInDegrees, endAngleInDegrees] };
      const output: AngleSweep = AngleSweep.fromJSON(json);
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.startAngle.radians, startAngleInRadians));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.endAngle.radians, endAngleInRadians));
    }),
    it("Angle.fromJsonRadian", () => {
      const startAngle: number = Math.PI / 6;
      const endAngle: number = Math.PI / 3;
      const json: AngleSweepProps = { radians: [startAngle, endAngle] };
      const output: AngleSweep = AngleSweep.fromJSON(json);
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.startAngle.radians, startAngle));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.endAngle.radians, endAngle));
    }),
    it("Angle.fromJsonOtherwise", () => {
      const startAngle: number = 0;
      const endAngle: number = 2 * Math.PI;
      const json: any = { x: 1, y: 2 };
      const output: AngleSweep = AngleSweep.fromJSON(json);
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.startAngle.radians, startAngle));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.endAngle.radians, endAngle));
    });
});

describe("Angle.create", () => {
  it("Angle.createClone", () => {
    const expected: AngleSweep = AngleSweep.createStartEndDegrees(30, 60);
    const output: AngleSweep = AngleSweep.create(expected);
    assert.isOk(output.isAlmostEqual(expected));
  }),
    it("Angle.createStartEnd", () => {
      const result: AngleSweep = AngleSweep.create360();
      const startAngle: Angle = Angle.createRadians(Math.PI / 6);
      const endAngle: Angle = Angle.createRadians(Math.PI / 3);
      AngleSweep.createStartEnd(startAngle, endAngle, result);
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(result.startAngle.radians, startAngle.radians));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(result.endAngle.radians, endAngle.radians));
    }),
    it("Angle.createStartSweepRadians", () => {
      const result: AngleSweep = AngleSweep.create360();
      const startAngle: number = Math.PI / 6;
      const endAngle: number = Math.PI / 3;
      const sweep: number = Math.PI / 6;
      AngleSweep.createStartSweepRadians(startAngle, sweep, result);
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(result.startAngle.radians, startAngle));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(result.endAngle.radians, endAngle));
    }),
    it("Angle.createStartSweepRadiansDefault", () => {
      const startAngle: number = 0;
      const endAngle: number = Math.PI;
      const output: AngleSweep = AngleSweep.createStartSweepRadians();
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.startAngle.radians, startAngle));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.endAngle.radians, endAngle));
    });
});

describe("Angle.HalfAngle", () => {
  it("Angle.HalfAngle", () => {
    const ck = new Checker();
    for (let theta = 0.0; theta < 5.0; theta = 0.1 + 1.5 * theta) {
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const trig = Angle.trigValuesToHalfAngleTrigValues(c, s);
      ck.testCoordinate(c, Math.cos(2.0 * trig.radians));
      ck.testCoordinate(s, Math.sin(2.0 * trig.radians));
    }
    expect(ck.getNumErrors()).equals(0);
  }),
    it("Angle.NE", () => {
      const ck = new Checker();
      const r = 2;
      const angle = Math.PI / 3;
      const halfAngle = angle / 2;
      const rCos2A = r * Math.cos(angle);
      const rSin2A = r * Math.sin(angle);
      const trig = Angle.trigValuesToHalfAngleTrigValues(rCos2A, rSin2A);
      ck.testAngleNoShift(Angle.createRadians(halfAngle), Angle.createRadians(trig.radians));
      expect(ck.getNumErrors()).equals(0);
    }),
    it("Angle.SE", () => {
      const ck = new Checker();
      const r = 2;
      const angle = -Math.PI / 3;
      const halfAngle = angle / 2;
      const rCos2A = r * Math.cos(angle);
      const rSin2A = r * Math.sin(angle);
      const trig = Angle.trigValuesToHalfAngleTrigValues(rCos2A, rSin2A);
      ck.testAngleNoShift(Angle.createRadians(halfAngle), Angle.createRadians(trig.radians));
      expect(ck.getNumErrors()).equals(0);
    }),
    it("Angle.NW", () => {
      const ck = new Checker();
      const r = 2;
      const angle = 3 * Math.PI / 4;
      const halfAngle = angle / 2;
      const rCos2A = r * Math.cos(angle);
      const rSin2A = r * Math.sin(angle);
      const trig = Angle.trigValuesToHalfAngleTrigValues(rCos2A, rSin2A);
      ck.testAngleNoShift(Angle.createRadians(halfAngle), Angle.createRadians(trig.radians));
      expect(ck.getNumErrors()).equals(0);
    }),
    it("Angle.SW", () => {
      const ck = new Checker();
      const r = 2;
      const angle = -3 * Math.PI / 4;
      const halfAngle = angle / 2;
      const rCos2A = r * Math.cos(angle);
      const rSin2A = r * Math.sin(angle);
      const trig = Angle.trigValuesToHalfAngleTrigValues(rCos2A, rSin2A);
      ck.testAngleNoShift(Angle.createRadians(halfAngle), Angle.createRadians(trig.radians));
      expect(ck.getNumErrors()).equals(0);
    });
});

describe("Angle.cloneComplement", () => {
  it("Angle.cloneComplementReverseDirectionFalse", () => {
    // angle sweep is (30,60) so complement is (60,390) with reverseDirection = false
    const startAngle: number = Math.PI / 6;
    const endAngle: number = Math.PI / 3;
    const startAngleComplement: number = Math.PI / 3;
    const endAngleComplement: number = 2 * Math.PI + Math.PI / 6;
    const angleSweep: AngleSweep = AngleSweep.createStartEndRadians(startAngle, endAngle);
    const output: AngleSweep = angleSweep.cloneComplement();
    assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.startAngle.radians, startAngleComplement));
    assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.endAngle.radians, endAngleComplement));
  }),
    it("Angle.cloneComplementReverseDirectionTrue", () => {
      // angle sweep is (30,60) so complement is (30, -300) with reverseDirection = true
      const startAngle: number = Math.PI / 6;
      const endAngle: number = Math.PI / 3;
      const startAngleComplement: number = Math.PI / 6;
      const endAngleComplement: number = - 2 * Math.PI + Math.PI / 3;
      const angleSweep: AngleSweep = AngleSweep.createStartEndRadians(startAngle, endAngle);
      const output: AngleSweep = angleSweep.cloneComplement(true);
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.startAngle.radians, startAngleComplement));
      assert.isOk(Angle.isAlmostEqualRadiansNoPeriodShift(output.endAngle.radians, endAngleComplement));
    });
});

describe("Angle.isAlmostEqualAllowPeriodShift", () => {
  it("Angle.isAlmostEqualAllowPeriodShiftTrue", () => {
    const thisAngle: Angle = Angle.createRadians(1);
    const otherAngle: Angle = Angle.createRadians(1 + Angle.pi2Radians + 1e-15);
    const output: boolean = thisAngle.isAlmostEqualAllowPeriodShift(otherAngle);
    expect(output).equal(true);
  }),
    it("Angle.isAlmostEqualAllowPeriodShiftFalse", () => {
      const thisAngle: Angle = Angle.createRadians(1);
      const otherAngle: Angle = Angle.createRadians(Angle.pi2Radians);
      const output: boolean = thisAngle.isAlmostEqualAllowPeriodShift(otherAngle);
      expect(output).equal(false);
    }),
    it("Angle.isAlmostEqualAllowPeriodShiftTrueWithDefaultTolerance", () => {
      const thisAngle: Angle = Angle.createRadians(1);
      const otherAngle: Angle = Angle.createRadians(0.9 + Angle.pi2Radians);
      const radianTol: number = 0.2;
      const output: boolean = thisAngle.isAlmostEqualAllowPeriodShift(otherAngle, radianTol);
      expect(output).equal(true);
    });
});

describe("Angle.isAlmostEqualNoPeriodShift", () => {
  it("Angle.isAlmostEqualNoPeriodShiftTrue", () => {
    const thisAngle: Angle = Angle.createRadians(1);
    const otherAngle: Angle = Angle.createRadians(1 + 1e-15);
    const output: boolean = thisAngle.isAlmostEqualNoPeriodShift(otherAngle);
    expect(output).equal(true);
  }),
    it("Angle.isAlmostEqualNoPeriodShiftFalse", () => {
      const thisAngle: Angle = Angle.createRadians(1);
      const otherAngle: Angle = Angle.createRadians(1 + Angle.pi2Radians + 1e-15);
      const output: boolean = thisAngle.isAlmostEqualNoPeriodShift(otherAngle);
      expect(output).equal(false);
    }),
    it("Angle.isAlmostEqualNoPeriodShiftTrueWithDefaultTolerance", () => {
      const thisAngle: Angle = Angle.createRadians(1);
      const otherAngle: Angle = Angle.createRadians(0.9);
      const radianTol: number = 0.2;
      const output: boolean = thisAngle.isAlmostEqualNoPeriodShift(otherAngle, radianTol);
      expect(output).equal(true);
    });
});

describe("Angle.angleToUnboundedFraction", () => {
  it("Angle.10and(20,30)", () => {
    const theta: Angle = Angle.createRadians(Math.PI / 18); // 10 degrees
    const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 9, Math.PI / 6); // (20,30) degrees
    const outputFraction: number = sweep.angleToUnboundedFraction(theta);
    const expectedFraction = -1; // (10-20)/(30-20) = -10/10 = -1
    assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
  }),
    it("Angle.25and(20,30)", () => {
      const theta: Angle = Angle.createRadians(5 * Math.PI / 36); // 25 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 9, Math.PI / 6); // (20,30) degrees
      const outputFraction: number = sweep.angleToUnboundedFraction(theta);
      const expectedFraction = 0.5; // (25-20)/(30-20) = 5/10 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.40and(20,30)", () => {
      const theta: Angle = Angle.createRadians(2 * Math.PI / 9); // 40 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 9, Math.PI / 6); // (20,30) degrees
      const outputFraction: number = sweep.angleToUnboundedFraction(theta);
      const expectedFraction = 2; // (40-20)/(30-20) = 20/10 = 2
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.385and(20,30)", () => {
      const theta: Angle = Angle.createRadians(2 * Math.PI + 5 * Math.PI / 36); // 360+25 = 385 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 9, Math.PI / 6); // (20,30) degrees
      const outputFraction: number = sweep.angleToUnboundedFraction(theta);
      const expectedFraction = 36.5; // (385-20)/(30-20) = 365/10 = 36.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    });
});

describe("Angle.radiansToPositivePeriodicFractionStartEnd", () => {
  it("Angle.10and(20,30)", () => {
    const radians: number = Math.PI / 18; // 10 degrees
    const radians0: number = Math.PI / 9; // 20 degrees
    const radians1: number = Math.PI / 6; // 30 degrees
    const outputFraction: number = AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1);
    const expectedFraction = 35; // (10-20)/(30-20) = -10/10 ==> 350/10 = 35
    assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
  }),
    it("Angle.25and(20,30)", () => {
      const radians: number = 5 * Math.PI / 36; // 25 degrees
      const radians0: number = Math.PI / 9; // 20 degrees
      const radians1: number = Math.PI / 6; // 30 degrees
      const outputFraction: number = AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1);
      const expectedFraction = 0.5; // (25-20)/(30-20) = 5/10 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.40and(20,30)", () => {
      const radians: number = 2 * Math.PI / 9; // 40 degrees
      const radians0: number = Math.PI / 9; // 20 degrees
      const radians1: number = Math.PI / 6; // 30 degrees
      const outputFraction: number = AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1);
      const expectedFraction = 2; // (40-20)/(30-20) = 20/10 = 2
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.385and(20,30)", () => {
      const radians: number = 2 * Math.PI + 5 * Math.PI / 36; // 360+25 = 385 degrees
      const radians0: number = Math.PI / 9; // 20 degrees
      const radians1: number = Math.PI / 6; // 30 degrees
      const outputFraction: number = AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1);
      const expectedFraction = 0.5; // (385-20)/(30-20) = 365/10 ==> 5/10 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.10and(30,20)", () => {
      const radians: number = Math.PI / 18; // 10 degrees
      const radians0: number = Math.PI / 6; // 30 degrees
      const radians1: number = Math.PI / 9; // 20 degrees
      const outputFraction: number = AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1);
      const expectedFraction = 2; // (10-30)/(20-30) = -20/-10 ==> 20/10 = 2
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.25and(30,20)", () => {
      const radians: number = 5 * Math.PI / 36; // 25 degrees
      const radians0: number = Math.PI / 6; // 30 degrees
      const radians1: number = Math.PI / 9; // 20 degrees
      const outputFraction: number = AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1);
      const expectedFraction = 0.5; // (25-30)/(20-30) = -5/-10 ==> 5/10 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.40and(30,20)", () => {
      const radians: number = 2 * Math.PI / 9; // 40 degrees
      const radians0: number = Math.PI / 6; // 30 degrees
      const radians1: number = Math.PI / 9; // 20 degrees
      const outputFraction: number = AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1);
      const expectedFraction = 35; // (40-30)/(20-30) = 10/-10 ==> -10/10 ==> 350/10 = 35
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.385and(30,20)", () => {
      const radians: number = 2 * Math.PI + 5 * Math.PI / 36; // 360+25 = 385 degrees
      const radians0: number = Math.PI / 6; // 30 degrees
      const radians1: number = Math.PI / 9; // 20 degrees
      const outputFraction: number = AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1);
      const expectedFraction = 0.5; // (385-30)/(20-30) = 355/-10 ==> -355/10 ==> 5/10 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    });
});

describe("Angle.radiansToSignedPeriodicFraction", () => {
  it("Angle.10and(20,30)", () => {
    const radians: number = Math.PI / 18; // 10 degrees
    const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 9, Math.PI / 6); // (20,30) degrees
    const outputFraction: number = sweep.radiansToSignedPeriodicFraction(radians);
    const expectedFraction = -1; // (10-20 - 0.5*10)/(30-20) = -15/10 = -1.5 ==> 0.5 + (-1.5) = 1
    assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
  }),
    it("Angle.25and(20,30)", () => {
      const radians: number = 5 * Math.PI / 36; // 25 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 9, Math.PI / 6); // (20,30) degrees
      const outputFraction: number = sweep.radiansToSignedPeriodicFraction(radians);
      const expectedFraction = 0.5; // (25-20 - 0.5*10)/(30-20) = 0 ==> 0.5 + 0 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.40and(20,30)", () => {
      const radians: number = 2 * Math.PI / 9; // 40 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 9, Math.PI / 6); // (20,30) degrees
      const outputFraction: number = sweep.radiansToSignedPeriodicFraction(radians);
      const expectedFraction = 2; // (40-20 - 0.5*10)/(30-20) = 15/10 = 1.5 ==> 0.5 + 1.5 = 2
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.385and(20,30)", () => {
      const radians: number = 2 * Math.PI + 5 * Math.PI / 36; // 360+25 = 385 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 9, Math.PI / 6); // (20,30) degrees
      const outputFraction: number = sweep.radiansToSignedPeriodicFraction(radians);
      const expectedFraction = 0.5; // (385-20 - 0.5*10)/(30-20) = 360/10 ==> 0/10 = 0 ==> 0.5 + 0 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.10and(30,20)", () => {
      const radians: number = Math.PI / 18; // 10 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 6, Math.PI / 9); // (30,20) degrees
      const outputFraction: number = sweep.radiansToSignedPeriodicFraction(radians);
      const expectedFraction = 2; // (10-30 + 0.5*10)/(20-30) = -15/-10 ==> 15/10 = 1.5 ==> 0.5 + 1.5 = 2
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.25and(30,20)", () => {
      const radians: number = 5 * Math.PI / 36; // 25 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 6, Math.PI / 9); // (30,20) degrees
      const outputFraction: number = sweep.radiansToSignedPeriodicFraction(radians);
      const expectedFraction = 0.5; // (25-30 + 0.5*10)/(20-30) = 0 ==> 0.5 + 0 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.40and(30,20)", () => {
      const radians: number = 2 * Math.PI / 9; // 40 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 6, Math.PI / 9); // (30,20) degrees
      const outputFraction: number = sweep.radiansToSignedPeriodicFraction(radians);
      const expectedFraction = -1; // (40-30 + 0.5*10)/(20-30) = 15/-10 ==> -15/10 = -1.5 ==> 0.5 + (-1.5) = -1
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    }),
    it("Angle.385and(30,20)", () => {
      const radians: number = 2 * Math.PI + 5 * Math.PI / 36; // 360+25 = 385 degrees
      const sweep: AngleSweep = AngleSweep.createStartEndRadians(Math.PI / 6, Math.PI / 9); // (30,20) degrees
      const outputFraction: number = sweep.radiansToSignedPeriodicFraction(radians);
      const expectedFraction = 0.5; // (385-30 + 0.5*10)/(20-30) = 360/10 ==> 0/10 = 0 ==> 0.5 + 0 = 0.5
      assert.isOk(Geometry.isSameCoordinate(expectedFraction, outputFraction));
    });
});

describe("Angle.dotProductsToHalfAngleTrigValues", () => {
  it("Angle.SquareEllipseAxes", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const c = Point3d.createZero(); // the center of ellipse
    // u and v are 2 random vectors which define vector basis for the ellipse x(t) = c + U cos(t) + V sin(t)
    const U = Vector3d.create(3, 1);
    const V = Vector3d.create(2, 2);
    const sweep = AngleSweep.createStartEndRadians(2 / 5 * Math.PI, 4 / 3 * Math.PI); // a radom sweep on the ellipse
    const arc0 = Arc3d.create(c, U, V, sweep); // the arc on the ellipse (limited by the sweep)
    // uSeg0 and vSeg0 are the 2 ellipse vector basis (they have the same direction as U and V)
    const uSeg0 = LineSegment3d.create(arc0.center, arc0.center.plus(arc0.vector0));
    const vSeg0 = LineSegment3d.create(arc0.center, arc0.center.plus(arc0.vector90));
    const arc0full = arc0.clone();
    arc0full.sweep = AngleSweep.create360(arc0full.sweep.startRadians);  // the full ellipse created by c, u, and v
    const dotUU = U.dotProduct(U);
    const dotVV = V.dotProduct(V);
    const dotUV = U.dotProduct(V);
    const t = Angle.dotProductsToHalfAngleTrigValues(dotUU, dotVV, dotUV); // the angle at which one of the ellipse semi-axis is located
    // perpSeg is one of the ellipse semi-axis
    const perpSeg = LineSegment3d.create(arc0.center, arc0.angleToPointAndDerivative(Angle.createRadians(t.radians)).origin);
    const arc1json = arc0.toScaledMatrix3d(); // toScaledMatrix3d internally calls dotProductsToHalfAngleTrigValues
    // arc1 is the squared arc (created by 2 perpendicular vector basis). arc1 is same as arc0 but arc1 is
    // created by the 2 semi-axis (2 perpendicular vector basis) while arc0 is created by 2 random vector basis.
    // note that toScaledMatrix3d returns unit axis so we have to apply scale (r0 and r90)
    const arc1 = Arc3d.create(arc1json.center, arc1json.axes.columnX().scale(arc1json.r0), arc1json.axes.columnY().scale(arc1json.r90), arc1json.sweep);
    // uSeg0 and vSeg0 are the 2 ellipse semi-axis. note that uSeg1 is same as perpSeg
    const uSeg1 = LineSegment3d.create(arc1.center, arc1.center.plus(arc1.vector0));
    const vSeg1 = LineSegment3d.create(arc1.center, arc1.center.plus(arc1.vector90));
    ck.testPoint3d(arc0.startPoint(), arc1.startPoint(), "arc and squared arc start point same");
    ck.testPoint3d(arc0.endPoint(), arc1.endPoint(), "arc and squared arc end point same");
    ck.testCoordinate(arc0.curveLength(), arc1.curveLength(), "arc and squared arc lengths same");
    ck.testPoint3d(
      perpSeg.startPoint(),
      uSeg1.startPoint(),
      "the radial segment at angle t in the original arc has the same start point as the semi-axis at angle 0 in the squared arc",
    );
    ck.testPoint3d(
      perpSeg.endPoint(),
      uSeg1.endPoint(),
      "the radial segment at angle t in the original arc has the same end point as the semi-axis at angle 0 in the squared arc",
    );
    ck.testPoint3d(perpSeg.point1Ref, arc1.center.plusScaled(arc1.vector0, 1.0), "point at angle t in arc equals point at angle 0 in squared arc");
    ck.testFalse(arc0.vector0.angleTo(arc1.vector0).isAlmostEqual(Angle.createRadians(t.radians)), "angle t is NOT measured from u to perpSeg");

    // for visualization in MicroStation
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arc0, arc0full, uSeg0, vSeg0, perpSeg, arc1, uSeg1, vSeg1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Angle", "SquareEllipseAxes");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Angle.radiansBetweenVectorsXYZ", () => {
  it("Angle.radiansBetweenVectorsXYZ", () => {
    const radians = Angle.radiansBetweenVectorsXYZ(1 / 2, Math.sqrt(3) / 2, 0, -1 / 2, Math.sqrt(3) / 2, 0);
    const angle = Angle.createRadians(radians);
    const expectedRadian: number = 60;
    expect(Geometry.isAlmostEqualOptional(angle.degrees, expectedRadian, Geometry.smallAngleRadians)).equal(true);
  });
});

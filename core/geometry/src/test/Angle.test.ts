/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { YawPitchRollAngles, Geometry, Angle, AngleSweep, AxisOrder, Complex, Point3d, RotMatrix, Vector3d } from "../geometry-core";
import { Range1d } from "../Range";
import { Sample } from "../serialization/GeometrySamples";
import { Checker } from "./Checker";
import { expect } from "chai";
import { OrderedRotationAngles } from "../OrderedRotationAngles";

/* tslint:disable:no-console */
class AngleTests {
  constructor(public noisy: boolean = false) { }
  public TestAlmostEqual(ck: Checker) {
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
  public TestAdjust(ck: Checker) {
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
          console.log("Adjust angle ", theta0.degrees,
            "  positive ", theta1.degrees,
            "    signed", theta2.degrees);
        ck.testBoolean(true, theta0.isAlmostEqualAllowPeriodShift(theta1), "adjust positive");
        ck.testBoolean(true, theta0.isAlmostEqualAllowPeriodShift(theta2), "adjust signed");
      }
    }
  }

  public TestFractions(sweep: AngleSweep, ck: Checker) {
    const fractionCandidates = [0, 0.25, 0.5, 0.75, 1.0, -0.3, 1.3, -10, 10];
    let f0 = 0;
    const reverseSweep = sweep.clone();
    reverseSweep.reverseInPlace();
    const sweep2 = AngleSweep.createStartEndDegrees(1000, -21312); // hopeful gibberish unequal to any supplied sweep.
    sweep2.setFrom(sweep);
    ck.testTrue(sweep.isAlmostEqualAllowPeriodShift(sweep2));
    ck.testBoolean(sweep.isCCW(), !reverseSweep.isCCW(), "reversal flips ccw");
    ck.testTrue(sweep.isAlmostEqualAllowPeriodShift(sweep2));
    ck.testFalse(sweep.isAlmostEqualAllowPeriodShift(reverseSweep));
    const fractionPeriod = sweep.fractionPeriod();

    for (f0 of fractionCandidates) {
      const theta0 = sweep.fractionToAngle(f0);
      ck.testAngleNoShift(theta0, reverseSweep.fractionToAngle(1.0 - f0));
      const f1 = sweep.angleToUnboundedFraction(theta0);
      // unbounded fraction always matches exactly . .
      ck.testCoordinate(f0, f1, "unbounded fraction round trip");
      const f2 = sweep.angleToPositivePeriodicFraction(theta0);
      const theta2 = sweep.fractionToAngle(f2);
      const f3 = sweep.angleToSignedPeriodicFraction(theta0);
      const theta3 = sweep.fractionToAngle(f3);
      const inside = sweep.isAngleInSweep(theta0);

      ck.testAngleAllowShift(theta0, theta2, "angleToPositivePeriodicFraction");
      ck.testAngleAllowShift(theta0, theta3, "angleToSignedPeriodicFraction");
      ck.testBoolean(
        inside, f2 <= 1.0, "isAngleInSweep agrees with positivePeriodicFraction");

      ck.testAngleAllowShift(
        sweep.fractionToAngle(f0),
        sweep.fractionToAngle(f0 + fractionPeriod),
        "fractionPeriod steps 360");
      ck.testAngleAllowShift(
        sweep.fractionToAngle(f0),
        sweep.fractionToAngle(f0 - fractionPeriod),
        "fractionPeriod steps 360");
    }
  }
}

describe("Angle.AlmostEqual", () => {
  it("Verify angle tolerance tests", () => {
    const ck = new Checker();
    const source = new AngleTests(false);
    source.TestAlmostEqual(ck);
    ck.testTrue(Angle.createDegrees(0).isExactZero());
    ck.testTrue(Angle.createRadians(0).isExactZero());
    ck.testFalse(Angle.createRadians(1.0e-20).isExactZero());
    ck.checkpoint("End Angle.AlmostEqual");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Angle.Adjust", () => {
  it("Verify angle period adjustments tests", () => {
    const ck = new Checker();
    const source = new AngleTests(false);
    source.TestAdjust(ck);
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
      ck.testFalse(theta.isFullCircle());
    }
    ck.checkpoint("Angle.Trig");
    expect(ck.getNumErrors()).equals(0);
  });
});
/** Test various boolean properties.
 * * sweepDegrees is tested as coordinate
 */
function testSweep(ck: Checker, sweep: AngleSweep,
  isCCW: boolean,
  isFullCircle: boolean,
  sweepDegrees: number | undefined) {
  ck.testBoolean(sweep.isCCW(), isCCW, "sweep.isCCW");
  ck.testBoolean(sweep.isFullCircle(), isFullCircle, "sweep.isFullCircle");
  if (sweepDegrees !== undefined)
    ck.testCoordinate(sweepDegrees, sweep.sweepDegrees, "sweep.sweepDegrees");
}
describe("AngleSweep", () => {
  it("Fractions", () => {
    const ck = new Checker();
    const source = new AngleTests(false);
    source.TestFractions(AngleSweep.createStartSweepDegrees(0, 90), ck);
    source.TestFractions(AngleSweep.createStartSweepRadians(-1, 1), ck);
    source.TestFractions(AngleSweep.createStartSweepRadians(1, -2), ck);
    source.TestFractions(AngleSweep.createStartSweep(Angle.createRadians(0), Angle.createDegrees(360)), ck);
    ck.checkpoint("AngleSweeps.TestFractions");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Caps", () => {
    const ck = new Checker();
    const sweep = AngleSweep.createStartEndDegrees(-100, 200);
    ck.testLT(180, sweep.sweepDegrees);
    sweep.capLatitudeInPlace();
    testSweep(ck, sweep, true, false, 180);
    const smallSweep = AngleSweep.createStartEndDegrees(-10, 30);
    const smallSweep1 = smallSweep.clone();
    smallSweep.capLatitudeInPlace();
    testSweep(ck, smallSweep1, true, false, smallSweep.sweepDegrees);

    const negativeSweep = AngleSweep.createStartEndDegrees(100, -100);
    testSweep(ck, negativeSweep, false, false, -200);
    negativeSweep.capLatitudeInPlace();
    testSweep(ck, negativeSweep, false, false, -180);

    ck.checkpoint("AngleSweeps.Caps");
    expect(ck.getNumErrors()).equals(0);
  });
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

class ComplexTests {
  public ck: Checker;
  constructor(public noisy: boolean = false) {
    this.ck = new Checker();
  }
  public getNumErrors(): number {
    this.ck.checkpoint(" ComplexTests");
    return this.ck.getNumErrors();
  }
  public exerciseComplexMethods(z0: Complex, z1: Complex) {
    const z2 = z0.plus(z1);
    const z3 = z2.times(z2);
    const z3root = z3.sqrt();
    const z4 = z3.divide(z2);
    this.ck.testComplex(z2, z3root, "complex root");
    if (this.ck.testPointer(z4, "Complex divide") && z4 !== undefined)
      this.ck.testComplex(z2, z4, "complex divide");

  }
}

describe("Complex.HelloWorld", () => {
  const ck = new Checker();
  it("Complex arithmetic", () => {
    const tester = new ComplexTests();
    const z0 = Complex.create(2, 4);
    const z1 = Complex.create(3, 1);
    tester.exerciseComplexMethods(z0, z1);
    tester.exerciseComplexMethods(z1, z0);
    expect(tester.getNumErrors()).equals(0);
    z0.setFrom(z1);
    ck.testComplex(z0, z1, "Complex setFrom");
    const z2 = z0.clone();
    ck.testComplex(z0, z2, "Complex clone");
    z0.minus(z0, z0);
    z0.timesXY(1000, 1000);
    ck.testTrue(z0.x === 0 && z0.y === 0, "Complex minus itself");
    ck.testUndefined(z1.divide(z0), "Complex Divide is undefined");
    ck.testComplex(z0, z0.sqrt(), "Zero complex sqrt is still zero");

    const z3 = z1.sqrt();
    ck.testFalse(z3.x === 0 || z3.y === 0, "Non-zero complex sqrt is not zero");
    z3.set(-z3.x, z3.y);
    z3.sqrt(z3);
    ck.testFalse(z3.x === 0 || z3.y === 0, "Non-zero complex sqrt is not zero");
    const json: any = { x: 1, y: 2 };
    z0.setFromJSON(json);
    ck.testTrue(z0.x === 1 && z0.y === 2);
    z0.setFromJSON({ incorrectJson: true });
    ck.testTrue(z0.x === 0 && z0.y === 0);
    for (let i = 1; i < 20; i++) {
      z0.set(1, i);
      ck.testCoordinate(z0.angle().radians, Math.atan(z0.y / z0.x), "Complex angle check");
      ck.testCoordinate(z0.magnitude(), Math.sqrt(z0.x * z0.x + z0.y * z0.y), "Complex magnitude check");
    }
    const values = [-1.0, -0.9, -0.7, -0.5, 0.0, -0.1, 0.1, 0.3, 0.8, 1.0];
    for (const x of values) {
      for (const y of values) {
        const c0 = Complex.create(x, y);
        const c1 = c0.sqrt();
        const c2 = c1.times(c1);
        ck.testComplex(c0, c2, "Complex sqrt");
      }
    }
    const d0 = Complex.create();
    const d1 = Complex.create(1, 1);
    d1.set();
    ck.testComplex(d0, d1, "Complex arg defautls");
    ck.checkpoint("Complex.Helloword");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("YawPitchRollAngles", () => {
  it("HellowWorld", () => {
    const ck = new Checker();
    const ypr0 = YawPitchRollAngles.createDegrees(10, 20, 30);
    const matrix0: RotMatrix = ypr0.toRotMatrix();
    // console.log(ypr0);
    // console.log(matrix0);
    const ypr1 = YawPitchRollAngles.createFromRotMatrix(matrix0);
    // console.log (ypr1);
    if (ypr1)
      expect(ypr0.maxDiffRadians(ypr1)).lessThan(Geometry.smallAngleRadians);
    ck.checkpoint("YawPitchRollAngles.Helloword");
    expect(ck.getNumErrors()).equals(0);
  });
});

function multiplyMatricesByAxisOrder(xMatrix: RotMatrix, yMatrix: RotMatrix, zMatrix: RotMatrix, axisOrder: AxisOrder): RotMatrix {
  switch (axisOrder) {
    case AxisOrder.XYZ: return xMatrix.multiplyMatrixMatrix(yMatrix.multiplyMatrixMatrix(zMatrix));
    case AxisOrder.XZY: return xMatrix.multiplyMatrixMatrix(zMatrix.multiplyMatrixMatrix(yMatrix));
    case AxisOrder.YXZ: return yMatrix.multiplyMatrixMatrix(xMatrix.multiplyMatrixMatrix(zMatrix));
    case AxisOrder.YZX: return yMatrix.multiplyMatrixMatrix(zMatrix.multiplyMatrixMatrix(xMatrix));
    case AxisOrder.ZXY: return zMatrix.multiplyMatrixMatrix(xMatrix.multiplyMatrixMatrix(yMatrix));
    case AxisOrder.ZYX: return zMatrix.multiplyMatrixMatrix(yMatrix.multiplyMatrixMatrix(xMatrix));
  }
}

function multipleDegreeRotationsByAxisOrder(xDegrees: number, yDegrees: number, zDegrees: number, axisOrder: AxisOrder): RotMatrix {
  return multiplyMatricesByAxisOrder(
    RotMatrix.createRotationAroundVector(Vector3d.unitX(), Angle.createDegrees(xDegrees))!,
    RotMatrix.createRotationAroundVector(Vector3d.unitY(), Angle.createDegrees(yDegrees))!,
    RotMatrix.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(zDegrees))!,
    axisOrder);
}

/** This function only compares the angle values for rotations around x, y, and z. It does not care about order for going back to a matrix. */
function testEqualOrderedRotationAngles(ck: Checker, a: OrderedRotationAngles, b: OrderedRotationAngles) {
  const matrixA = a.toRotMatrix();
  const matrixB = b.toRotMatrix();
  if (!ck.testRotMatrix(matrixA, matrixB, "matrix images of OrderedRotationAngle pair")) {
    console.log("*********************");
    console.log("");
    const a1 = OrderedRotationAngles.createFromRotMatrix(matrixA, a.order);
    const b1 = OrderedRotationAngles.createFromRotMatrix(matrixB, b.order);
    console.log("A:", a, matrixA, a1);
    console.log("B:", b, matrixB, b1);
  }
}

function testMultiAngleEquivalence(ck: Checker, xDegrees: number, yDegrees: number, zDegrees: number) {
  // WE EXPECT -- OrderedRotationAngles constructs TRANSPOSED matrices and multiplies them together in REVERSE ORDER
  // So ...
  // consider each axis order paired with its reverse order ...
  // and compare matrices constructed by
  //   (1) the (very compact) formulas in OrderedRotationAngles with
  //   (2) full matrix products
  for (const orderPair of [
    [AxisOrder.XYZ, AxisOrder.ZYX],
    [AxisOrder.XZY, AxisOrder.YZX],
    [AxisOrder.YXZ, AxisOrder.ZXY],
    [AxisOrder.YZX, AxisOrder.XZY],
    [AxisOrder.ZXY, AxisOrder.YXZ],
    [AxisOrder.ZYX, AxisOrder.XYZ]]) {
    const angles = OrderedRotationAngles.createDegrees(xDegrees, yDegrees, zDegrees, orderPair[0]);
    const matrixA = angles.toRotMatrix();
    const matrixB = multipleDegreeRotationsByAxisOrder(-xDegrees, -yDegrees, -zDegrees, orderPair[1]);
    ck.testRotMatrix(matrixA, matrixB, "Compound rotation pair with order and sign reversal");

  }
}
describe("OrderedRotationAngles", () => {

  it("OrderedRotationAngles.SingleRotation", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 0, 0);
    testMultiAngleEquivalence(ck, 0, 10, 0);
    testMultiAngleEquivalence(ck, 0, 0, 10);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.TwoRotations", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 20, 0);
    testMultiAngleEquivalence(ck, 0, 10, 20);
    testMultiAngleEquivalence(ck, 20, 0, 10);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.ThreeRotations", () => {
    const ck = new Checker();
    testMultiAngleEquivalence(ck, 10, 20, 30);
    testMultiAngleEquivalence(ck, 50, 10, 20);
    testMultiAngleEquivalence(ck, 20, 40, 10);
    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.RoundTrip", () => {
    const ck = new Checker();

    const primaryRadians = 1.0;
    for (const axisOrder of [AxisOrder.YXZ, AxisOrder.ZYX, AxisOrder.XYZ, AxisOrder.XZY, AxisOrder.YXZ, AxisOrder.YZX, AxisOrder.ZXY, AxisOrder.ZYX]) {
      // console.log("  AXIS ORDER " + axisOrder);
      for (const treatVectorsAsColumns of [true, false]) {
        const savedFlag = OrderedRotationAngles.treatVectorsAsColumns;
        OrderedRotationAngles.treatVectorsAsColumns = treatVectorsAsColumns;
        for (const factor of [1.0, 0.05, 2.0, 4.2343, 0.001, 0.0001, 0.00001, -1.0, -0.4]) {
          const r = primaryRadians * factor;
          const q = 0.25;
          const q1 = Math.PI - r;
          const q2 = primaryRadians * Math.abs(0.7 - factor);
          for (const anglesA of [
            // one angle
            OrderedRotationAngles.createRadians(r, 0, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, r, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, 0, r, axisOrder),
            // two angles
            OrderedRotationAngles.createRadians(r, q, 0, axisOrder),
            OrderedRotationAngles.createRadians(q, r, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, r, q, axisOrder),
            OrderedRotationAngles.createRadians(0, q, r, axisOrder),
            OrderedRotationAngles.createRadians(q, 0, r, axisOrder),
            OrderedRotationAngles.createRadians(r, 0, q, axisOrder),
            // odd cases that failed earlier . . .
            OrderedRotationAngles.createRadians(r, q1, 0, axisOrder),
            OrderedRotationAngles.createRadians(0, r, q1, axisOrder),
            OrderedRotationAngles.createRadians(q1, 0, r, axisOrder),
            OrderedRotationAngles.createDegrees(0.001, 89.999, 0, axisOrder),
            OrderedRotationAngles.createDegrees(89.999, 0.001, 0, axisOrder),
            OrderedRotationAngles.createDegrees(0.001, 0, 89.999, axisOrder),
            OrderedRotationAngles.createDegrees(89.999, 0, 0.001, axisOrder),
            OrderedRotationAngles.createDegrees(0, 0.001, 89.999, axisOrder),
            OrderedRotationAngles.createDegrees(0, 89.999, 0.001, axisOrder),
            // three angles
            OrderedRotationAngles.createRadians(r, q1, q2, axisOrder),
            OrderedRotationAngles.createRadians(q2, r, q1, axisOrder),
            OrderedRotationAngles.createRadians(q2, q1, r, axisOrder),
          ]) {
            const matrixA = anglesA.toRotMatrix();
            const anglesB = OrderedRotationAngles.createFromRotMatrix(matrixA, axisOrder);
            testEqualOrderedRotationAngles(ck, anglesA, anglesB);
            expect(ck.getNumErrors()).equals(0);
          }
        }
        OrderedRotationAngles.treatVectorsAsColumns = savedFlag;
      }
    }
  });

  it("OrderedRotationAngles.ToRotMatrix", () => {
    const ck = new Checker();
    let x = 0, y = 0, z = 0;

    // No Rotation
    const angles = OrderedRotationAngles.createDegrees(x, y, z, AxisOrder.XYZ);
    const matrix = angles.toRotMatrix();
    ck.testTrue(matrix.isIdentity());

    // One Rotation (IN ROW ORDER, TRANSPOSE OF WHAT WE TYPICALLY REPRESENT)
    OrderedRotationAngles.createAngles(Angle.createDegrees(0), Angle.createDegrees(45), Angle.createDegrees(0), AxisOrder.YXZ, angles);
    angles.toRotMatrix(matrix);
    let expectedMatrix = RotMatrix.createRowValues(
      angles.yAngle.cos(), 0, -angles.yAngle.sin(),
      0, 1, 0,
      angles.yAngle.sin(), 0, angles.yAngle.cos(),
    );
    ck.testRotMatrix(matrix, expectedMatrix);

    // Three Rotations (EACH IN ROW ORDER, TRANSPOSE OF WHAT WE TYPICALLY REPRESENT)
    x = Math.PI / 2, y = 1.16937061629, z = 0.0349066;  // 45, 67.000001, and 2 degrees
    const rX = RotMatrix.createRowValues(
      1, 0, 0,
      0, Math.cos(x), Math.sin(x),
      0, -Math.sin(x), Math.cos(x),
    );
    const rY = RotMatrix.createRowValues(
      Math.cos(y), 0, -Math.sin(y),
      0, 1, 0,
      Math.sin(y), 0, Math.cos(y),
    );
    const rZ = RotMatrix.createRowValues(
      Math.cos(z), Math.sin(z), 0,
      -Math.sin(z), Math.cos(z), 0,
      0, 0, 1,
    );

    // Rotation using XYZ ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.XYZ, angles);
    angles.toRotMatrix(matrix);
    expectedMatrix = rZ.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rX, expectedMatrix);
    ck.testRotMatrix(matrix, expectedMatrix);

    // Rotation using reverse ZYX ordering
    OrderedRotationAngles.createRadians(x, y, z, AxisOrder.ZYX, angles);
    angles.toRotMatrix(matrix);
    expectedMatrix = rX.multiplyMatrixMatrix(rY, expectedMatrix).multiplyMatrixMatrix(rZ, expectedMatrix);
    ck.testRotMatrix(matrix, expectedMatrix);

    expect(ck.getNumErrors()).equals(0);
  });

  it("OrderedRotationAngles.FromRotMatrix", () => {
    const ck = new Checker();
    const /*x = .0192, y = .7564,*/ z = Math.PI / 2;

    // No Rotation
    const matrix = RotMatrix.createIdentity();
    const angles = OrderedRotationAngles.createFromRotMatrix(matrix, AxisOrder.YZX); // order doesn't matter
    const expectedAngles = OrderedRotationAngles.createRadians(0, 0, 0, AxisOrder.ZXY);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    // One Rotation (IN ROW ORDER, TRANSPOSE OF WHAT WE TYPICALLY REPRESENT)
    RotMatrix.createRowValues(
      Math.cos(z), Math.sin(z), 0,
      -Math.sin(z), Math.cos(z), 0,
      0, 0, 1, matrix,
    );

    OrderedRotationAngles.createFromRotMatrix(matrix, AxisOrder.YXZ, angles);
    OrderedRotationAngles.createRadians(0, 0, Math.PI / 2, AxisOrder.XYZ, expectedAngles);
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);
    OrderedRotationAngles.createFromRotMatrix(matrix, AxisOrder.ZXY, angles);  // order doesn't matter
    testEqualOrderedRotationAngles(ck, angles, expectedAngles);

    // Three Rotations (EACH IN ROW ORDER, TRANSPOSE OF WHAT WE TYPICALLY REPRESENT)
    /*
    const rX = RotMatrix.createRowValues(

    );
    const rY = RotMatrix.createRowValues(

    );
    const rZ = matrix.clone();

    */
    // ###TODO
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
  });
});

describe("AxisOrder", () => {
  it("AxisIndex", () => {
    const ck = new Checker();
    for (const phase of [0, 1, 2, 500, -10, -8, -2, -1]) {
      ck.testExactNumber(AxisOrder.XYZ,
        Geometry.axisIndexToRightHandedAxisOrder(3 * phase), "X==>XYZ");
      ck.testExactNumber(AxisOrder.YZX,
        Geometry.axisIndexToRightHandedAxisOrder(3 * phase + 1), "Y==>YZX");
      ck.testExactNumber(AxisOrder.ZXY,
        Geometry.axisIndexToRightHandedAxisOrder(3 * phase + 2), "X==>ZXY");
      for (const baseAxis of [0, 1, 2]) {
        const axis = phase * 3 + baseAxis;
        ck.testExactNumber(baseAxis, Geometry.cyclic3dAxis(axis), "Cyclic axis reduction");
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
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
    ck.testFalse(Geometry.isDistanceWithinTol(-4.0, 2.0));

    for (let x = 1.e-15; x < 0.001; x *= 10.0) {
      ck.testTrue(Geometry.isSmallMetricDistance(x) ===
        Geometry.isSmallMetricDistanceSquared(x * x));
      ck.testTrue(Geometry.isSmallMetricDistance(x) ===
        Geometry.isSmallMetricDistanceSquared(x * x));
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("lexical", () => {
    const ck = new Checker();
    const pointI = Point3d.create();
    const pointJ = Point3d.create();
    const lattice = Sample.createPoint3dLattice(-1, 2, 1);
    for (let i = 0; i < lattice.length; i++) {
      ck.testExactNumber(0, Geometry.lexicalXYZLessThan(lattice[i], lattice[i]));
      for (let j = i + 1; j < lattice.length; j++) {
        pointI.set(lattice[i].z, lattice[i].y, lattice[i].x);
        pointJ.set(lattice[j].z, lattice[j].y, lattice[j].x);
        ck.testExactNumber(-1,
          Geometry.lexicalXYZLessThan(pointI, pointJ));
        ck.testExactNumber(1,
          Geometry.lexicalXYZLessThan(pointJ, pointI));
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("MiscAngles", () => {
  it("InverseInterpolate", () => {
    const ck = new Checker();
    const xA = 3.5;
    const xB = 5.1;
    const gA = -2.0;
    const gB = 1.2;
    for (const fraction of [-2, 0.2, 0.8, 1.0, 2.0]) {
      const g = Geometry.interpolate(gA, fraction, gB);
      const x = Geometry.interpolate(xA, fraction, xB);
      const fraction1 = Geometry.inverseInterpolate01(gA, gB, g);
      if (!!fraction1) {
        ck.testCoordinate(fraction1, fraction, "inverse interpolate 01");
      }

      const x1 = Geometry.inverseInterpolate(xA, gA, xB, gB, g);
      if (!!x1) {
        ck.testCoordinate(x, x1, "inverse interpolate");
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
    console.log(" degrees round trip error range through Angle logic", errorRangeB);
    console.log(" degrees round trip error range through direct multiply", errorRangeC);
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
        ck.testCoordinate(angleB.radians, Angle.adjustRadians0To2Pi(Angle.degreesToRadians(degrees)),
          "adjustRadians0To2Pi", degrees);
        ck.testCoordinate(angleC.radians, Angle.adjustRadiansMinusPiPlusPi(Angle.degreesToRadians(degrees)),
          "adjustRadiansMinusPiPlusPi", degrees);
      }
    expect(ck.getNumErrors()).equals(0);
  });
  it("toJson", () => {
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

  it("defaults", () => {
    const ck = new Checker();
    const r10 = Angle.degreesToRadians(10);
    const full10 = AngleSweep.create360(r10);  // um .. why is the default in radians?
    const full0 = AngleSweep.create360();
    ck.testCoordinate(full10.sweepDegrees, full0.sweepDegrees);
    const fullRadiansA = AngleSweep.createStartEndRadians();
    const fullDegreesA = AngleSweep.createStartEndDegrees();
    ck.testTrue(fullRadiansA.isAlmostEqualNoPeriodShift(fullDegreesA), "radians, degrees defaults",
      fullRadiansA, fullDegreesA);
    // The createStartEndRadians () defaults to full circle !!!
    ck.testCoordinate(360, fullRadiansA.sweepDegrees);
    const sweepB = AngleSweep.create360();
    const sweepC = AngleSweep.createStartEndRadians(0, 1, sweepB);
    ck.testFalse(sweepB.isFullCircle());
    ck.testTrue(sweepC === sweepB);

    const sweepE = AngleSweep.createStartSweepDegrees(10, 23);
    ck.testFalse(sweepE.isAlmostEqualNoPeriodShift(fullRadiansA));
    sweepE.setStartEndDegrees(); // full circle default
    ck.testTrue(sweepE.isAlmostEqualAllowPeriodShift(fullDegreesA));
    const sweepF = AngleSweep.createStartSweepDegrees();
    ck.testTrue(sweepF.isAlmostEqualAllowPeriodShift(fullDegreesA));

    expect(ck.getNumErrors()).equals(0);
  });
});

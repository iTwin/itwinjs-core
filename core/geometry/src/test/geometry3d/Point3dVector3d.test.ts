/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

import { AxisIndex, AxisOrder, Geometry, PerpParallelOptions } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Point3dArrayCarrier } from "../../geometry3d/Point3dArrayCarrier";
import { Point3d, Vector3d, XYZ } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { XYZProps } from "../../geometry3d/XYZProps";
import { Sample } from "../../serialization/GeometrySamples";
import * as bsiChecker from "../Checker";

// cSpell:words Jcross CCWXY CWXY
describe("Point3d", () => {
  it("zeros", () => {
    const ck = new bsiChecker.Checker();
    const alwaysZero = Point3d.create(0, 0);
    const alwaysZeroA = Point3d.createZero();
    const alwaysZeroB = Point3d.createZero();
    ck.testTrue(alwaysZero.isExactEqual(alwaysZeroA));
    ck.testTrue(alwaysZero.isExactEqual(alwaysZeroB));

    const pointA = Point3d.create(1, 2);
    const epsilon = 1.0e-15;
    const pointB = Point3d.create(pointA.x, pointA.x + 0.01);
    ck.testFalse(Point3d.create(epsilon, epsilon).isAlmostEqualMetric(pointB), "is almost zero (epsilon)");
    ck.testFalse(pointA.isAlmostZero, "is almost zero");
    ck.testFalse(alwaysZero.isExactEqual(pointA));

    pointA.setZero();
    ck.testPoint3d(alwaysZero, pointA);
    ck.testTrue(alwaysZero.isAlmostZero, "is almost zero");
    ck.testTrue(Point3d.create(epsilon, epsilon).isAlmostZero, "is almost zero (epsilon)");
    ck.testTrue(Point3d.create(epsilon, epsilon).isAlmostEqualMetric(alwaysZero), "is almost zero (epsilon)");
    ck.testPoint3d(alwaysZero, alwaysZeroA);
    ck.checkpoint("Point3d.zeros");
    expect(ck.getNumErrors()).equals(0);
  });

  it("XYAndZ", () => {
    const ck = new bsiChecker.Checker();
    ck.testTrue(XYZ.isXYAndZ({ x: 1, y: 2, z: 4 }));
    ck.testFalse(XYZ.isXYAndZ({ x: 1, y: 2 }));
    ck.testFalse(XYZ.isXYAndZ({ y: 2, z: 1 }));
    ck.testFalse(XYZ.isXYAndZ({ x: 1, z: 2 }));
    expect(ck.getNumErrors()).equals(0);
  });

  it("Diffs", () => {
    const ck = new bsiChecker.Checker();
    const pointA = Point3d.create(1, 2);
    const pointB = Point3d.create(-2, 5);
    const vectorAB = pointA.vectorTo(pointB);
    const pointDiff = pointA.maxDiff(pointB);
    const pointA3d = Point3d.createFrom(pointA);
    const pointB3d = Point3d.createFrom(pointB);
    pointA3d.z = 32.9;
    pointB3d.z = 29.1;
    const vectorMax = vectorAB.maxAbs();
    ck.testCoordinate(pointDiff, vectorMax, "maxDiff, maxAbs");
    ck.testCoordinate(vectorAB.magnitude(), pointA.distance(pointB), "distance and magnitude");
    ck.testCoordinate(vectorAB.magnitudeSquared(), pointA.distanceSquared(pointB), "distance and magnitude");
    ck.testCoordinate(vectorAB.magnitudeSquaredXY(), pointA.distanceSquaredXY(pointB), "distance and magnitude");

    const d3 = pointA3d.distanceXY(pointB3d);
    const pointDist = pointA.distance(pointB);
    ck.testCoordinate(pointDist, d3, "point3d.distanceXY");
    ck.testCoordinate(pointDist * pointDist, pointA3d.distanceSquaredXY(pointB3d), "point3d.distanceXY");

    const symmetricLattice3 = Sample.createPoint3dLattice(-3, 1, 3);
    for (const point of symmetricLattice3) {
      const i = point.indexOfMaxAbs();
      const i1 = Geometry.cyclic3dAxis(i + 1);
      const i2 = Geometry.cyclic3dAxis(i + 2);
      ck.testLE(Math.abs(point.at(i1)), Math.abs(point.at(i)), "max abs 1");
      ck.testLE(Math.abs(point.at(i2)), Math.abs(point.at(i)), "max abs 2");
      ck.testExactNumber(Math.abs(point.at(i)), point.maxAbs(), "max abs versus index");
    }

    const boxI = Sample.createPoint3dLattice(1, 1, 2); // the usual 8 box points ...
    const boxJ = Sample.createPoint3dLattice(1.25, 0.7, 2.55);
    const origin = Point3d.create(6.9, 0.11, 0.4);
    const s1 = 0.23;
    const s2 = 0.91;
    const s3 = -1.49;
    const theta = Angle.createDegrees(20);
    const theta90 = Angle.createDegrees(90);

    for (const pointI of boxI) {
      const vectorI = origin.vectorTo(pointI);
      const rotateIXY = vectorI.rotateXY(theta);
      const rotateIXY90 = vectorI.rotate90CCWXY();
      ck.testExactNumber(rotateIXY.z, vectorI.z, "rotateXY preserves z");

      const thetaXY = vectorI.angleToXY(rotateIXY);
      const thetaXY90 = vectorI.angleToXY(rotateIXY90);
      ck.testAngleNoShift(theta, thetaXY, "rotateXY, angleXY");
      ck.testAngleNoShift(thetaXY90, theta90, "rotate90XY, angleXY");

      for (const pointJ of boxJ) {
        const vectorJ = origin.vectorTo(pointJ);
        const sizeQ0 = 0.754;
        const vectorIJcross = vectorI.sizedCrossProduct(vectorJ, sizeQ0)!;
        ck.testCoordinate(sizeQ0, vectorIJcross.magnitude());

        const signedAngle = vectorI.signedAngleTo(vectorJ, vectorIJcross);
        ck.testAngleNoShift(
          vectorI.angleTo(vectorJ),
          signedAngle,
          "cross product used consistently for signed angle");
        ck.testCoordinate(
          vectorJ.angleTo(vectorI).radians,
          signedAngle.radians,
          "cross product used consistently for reverse order signed angle");

        const vectorQ = vectorIJcross.plus(vectorI.scale(0.219));
        ck.testVector3d(vectorJ, vectorI.plus(vectorI.vectorTo(vectorJ)));
        ck.testPoint3d(
          origin.plus3Scaled(vectorI, s1, vectorJ, s2, vectorQ, s3),
          origin.plusScaled(vectorI, s1).plus2Scaled(vectorJ, s2, vectorQ, s3),
        );

        const vectorIJ = pointI.vectorTo(pointJ);
        const vectorIJV = vectorI.vectorTo(vectorJ);
        ck.testVector3d(vectorIJ, vectorIJV, "vectorTo between points, vectors");

        const unitIJV = vectorI.unitVectorTo(vectorJ);
        if (ck.testPointer(unitIJV)) {
          ck.testParallel(unitIJV, vectorIJ);
          ck.testCoordinate(unitIJV.dotProduct(vectorIJV), vectorI.distance(vectorJ));
        }

        /* be sure to exercise interpolatePointAndTangent with fractions on both sides of 0.5 */
        for (const f of [0.1, 0.5, 0.9, 1.1]) {
          const ray = Ray3d.interpolatePointAndTangent(pointI, f, pointJ, 1.0);
          const point = pointI.interpolate(f, pointJ);
          ck.testPoint3d(point, ray.origin);
          ck.testVector3d(vectorIJ, ray.direction); // because tangentScale = 1
        }

        /* remark -- we trust that:
        * pointI and pointJ are never equal
        * vectorI and vectorJ are never equal or parallel
        * vectorI and vectorJ are never parallel to a principal axis
        */
        const unitIJ = pointI.unitVectorTo(pointJ)!;
        ck.testCoordinate(unitIJ.dotProduct(vectorIJ), pointI.distance(pointJ));
        const fIJ = vectorI.fractionOfProjectionToVector(vectorJ);
        const perpVector = vectorI.minus(vectorJ.scale(fIJ));
        ck.testPerpendicular(vectorJ, perpVector, "projection vector");

        const rotateI90 = vectorI.rotate90Towards(vectorJ);
        if (ck.testPointer(rotateI90)) {
          ck.testPerpendicular(vectorI, rotateI90);
          const cross = vectorI.crossProduct(rotateI90);
          ck.testParallel(cross, vectorIJcross);
        }
      }
    }
    ck.checkpoint("Point3d.Diffs");
    expect(ck.getNumErrors()).equals(0);
  });

  it("createFrom", () => {
    const ck = new bsiChecker.Checker();
    const pointA = Point3d.createFrom({ x: 1, y: 2 });
    const pointB = Point3d.createFrom({ x: 1, y: 2, z: 3 });
    const pointA1 = Point3d.createFrom(new Float64Array([1, 2]));
    const pointB1 = Point3d.createFrom(new Float64Array([1, 2, 3]));
    ck.testPoint3d(pointA, pointA1);
    ck.testPoint3d(pointB, pointB1);
    const pointC = Point3d.createFrom(new Float64Array([1]));
    ck.testPoint3d(pointC, Point3d.create(1, 0, 0));
    const vectorA = Vector3d.createFrom({ x: 1, y: 2 });
    const vectorB = Vector3d.createFrom({ x: 1, y: 2, z: 3 });
    const vectorA1 = Vector3d.createFrom(new Float64Array([1, 2]));
    const vectorB1 = Vector3d.createFrom(new Float64Array([1, 2, 3]));
    ck.testVector3d(vectorA, vectorA1);
    ck.testVector3d(vectorB, vectorB1);
    const vectorC = Vector3d.createFrom(new Float64Array([1]));
    ck.testVector3d(vectorC, Vector3d.create(1, 0, 0));

    ck.testExactNumber(0, Point3d.createFrom(new Float64Array([])).maxAbs());
    ck.testExactNumber(0, Vector3d.createFrom(new Float64Array([])).maxAbs());
    expect(ck.getNumErrors()).equals(0);
  });

  it("Point3dArrayCarrier", () => {
    const ck = new bsiChecker.Checker();
    const pointArray1 = [Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(1, 1, 1)];
    const pointArray2 = [Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(1, 1, 1)];
    const carrier = new Point3dArrayCarrier(pointArray1);
    const carrierReverse = new Point3dArrayCarrier(pointArray2);
    carrierReverse.reverseInPlace();
    ck.testPoint3d(carrier.data[0], carrierReverse.data[3]);
    ck.testPoint3d(carrier.data[1], carrierReverse.data[2]);
    ck.testPoint3d(carrier.data[2], carrierReverse.data[1]);
    ck.testPoint3d(carrier.data[3], carrierReverse.data[0]);

    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Point3d.setFrom", () => {
  it("Point3d.setFrom", () => {
    const other: any = undefined;
    const thisPoint: Point3d = Point3d.create(1, 2, 3);
    const pointZero: Point3d = Point3d.create(0, 0, 0);
    thisPoint.setFrom(other);
    expect(thisPoint).to.deep.equal(pointZero);
  });
});

describe("Vector3d", () => {
  it("hello", () => {
    const ck = new bsiChecker.Checker();
    const pointA = Point3d.create(1, 2, 5);
    const pointB = Point3d.create(4, 2, 9);
    const q = 3.902;
    const vectorABq = pointA.scaledVectorTo(pointB, q);
    const vectorAB = pointA.vectorTo(pointB);
    ck.testParallel(vectorAB, vectorABq, "parallel vectors");
    ck.testCoordinate(q * vectorAB.magnitude(), vectorABq.magnitude(), "enforced magnitude");

    const vectorABxyz = Vector3d.createStartEndXYZXYZ(pointA.x, pointA.y, pointA.z, pointB.x, pointB.y, pointB.z);
    ck.testVector3d(vectorAB, vectorABxyz);

    ck.checkpoint("Vector3d.hello");
    expect(ck.getNumErrors()).equals(0);
  });

  it("CrossProducts", () => {
    const ck = new bsiChecker.Checker();
    const vectorA = Vector3d.create(-4, 4, 2);
    const unitZ = Vector3d.unitZ();
    const vectorB = Vector3d.create(0.3, 9.1, -2);
    const pointB0 = Point3d.create(3, 2, 8);
    const pointB1 = pointB0.plus(vectorB);
    ck.testCoordinate(vectorA.crossProductXY(vectorB), vectorA.tripleProduct(vectorB, unitZ), "crossProductXY");
    ck.testCoordinate(vectorA.crossProductStartEndXY(pointB0, pointB1), vectorA.tripleProduct(vectorB, unitZ), "crossProductXY");

    ck.checkpoint("Vector3d.DotProducts");
    expect(ck.getNumErrors()).equals(0);
  });

  it("XYAngle", () => {
    const ck = new bsiChecker.Checker();
    const unitX = Vector3d.unitX();
    const unitZ = Vector3d.unitZ();
    for (const z of [-0.2, 0, 1.8]) {
      for (const r of [0.5, 1.0, 2.9]) {
        for (const degrees of [-40, -179, 0, 10, 90, 170]) {
          const theta = Angle.createDegrees(degrees);
          const vector = Vector3d.createPolar(r, theta, z);
          ck.testCoordinate(vector.magnitudeXY(), r);
          ck.testAngleNoShift(theta, unitX.planarAngleTo(vector, unitZ));
        }
      }
    }

    ck.checkpoint("Point3d.zeros");
    expect(ck.getNumErrors()).equals(0);
  });
});

it("NormalizeWithDefault", () => {
  const ck = new bsiChecker.Checker();
  const vectorA = Vector3d.create(1, 2, 3);
  const vectorB = vectorA.normalizeWithDefault(1, 0, 0);
  ck.testParallel(vectorA, vectorB);
  ck.testCoordinate(1.0, vectorB.magnitude(), "unit vector magnitude");
  const vectorC = Vector3d.createZero();
  const vectorD = vectorC.normalizeWithDefault(0, 0, 1);
  ck.testVector3d(vectorD, Vector3d.unitZ());
  ck.checkpoint("Point3dArray.HelloWorld");
  expect(ck.getNumErrors()).equals(0);
});

it("RotateVectorAroundVector", () => {
  const ck = new bsiChecker.Checker();
  const vectorA = Vector3d.create(1, 2, 3);
  const axis = Vector3d.create(-1, 3, 6);
  const theta = Angle.createDegrees(20);
  const vectorA1 = Vector3d.createRotateVectorAroundVector(vectorA, axis, theta);
  if (ck.testPointer(vectorA1)) {
    const theta1 = vectorA.planarAngleTo(vectorA1, axis);
    ck.testAngleNoShift(theta, theta1);
  }

  const vectorA2 = Vector3d.createRotateVectorAroundVector(vectorA, axis);
  if (ck.testPointer(vectorA2)) {
    const theta1 = vectorA.planarAngleTo(vectorA2, axis);
    ck.testAngleNoShift(theta1, Angle.createDegrees(90));
  }
  ck.testUndefined(Vector3d.createRotateVectorAroundVector(vectorA, Vector3d.create(0, 0, 0)));
  expect(ck.getNumErrors()).equals(0);
});

describe("Point3d.setFromPoint3d", () => {
  it("Point3d.setFromPoint3d", () => {
    const thisPoint: Point3d = Point3d.create(1, 2, 3);
    const pointZero: Point3d = Point3d.create(0, 0, 0);
    thisPoint.setFromPoint3d();
    expect(thisPoint).to.deep.equal(pointZero);
  });
});

describe("Point3d.Point3dToJson", () => {
  it("Point3d.Point3dToJsonPositive", () => {
    const point: Point3d = Point3d.create(1, 2, 3);
    const expectedJson: XYZProps = { x: 1, y: 2, z: 3 };
    const outputJson: XYZProps = point.toJSONXYZ();
    expect(outputJson).to.deep.equal(expectedJson);
  }),
    it("Point3d.Point3dToJsonNegative", () => {
      const point: Point3d = Point3d.create(1, 2, 3);
      const expectedJson: XYZProps = { x: 1, y: 3, z: 2 };
      const outputJson: any = point.toJSONXYZ();
      expect(outputJson.x).equal(expectedJson.x);
      expect(outputJson.y).not.equal(expectedJson.y);
      expect(outputJson.z).not.equal(expectedJson.z);
    });
});

describe("Point3d.accessX", () => {
  it("Point3d.accessX", () => {
    const args: any = "args";
    const x: any = Point3d.accessX(args);
    expect(x).equal(undefined);
  });
});

describe("Point3d.accessY", () => {
  it("Point3d.accessY", () => {
    const args: any = "args";
    const y: any = Point3d.accessY(args);
    expect(y).equal(undefined);
  });
});

describe("Point3d.accessZ", () => {
  it("Point3d.accessZ", () => {
    const args: any = "args";
    const z: any = Point3d.accessZ(args);
    expect(z).equal(undefined);
  });
});

describe("Point3d.x", () => {
  it("Point3d.xNotGiven", () => {
    const xyz: XYZProps = { y: 2, z: 3 };
    const x: number = Point3d.x(xyz);
    expect(x).equal(0);
  }),
    it("Point3d.xDefined", () => {
      const xyz: XYZProps = { x: 1, y: 2, z: 3 };
      const x: number = Point3d.x(xyz);
      expect(x).equal(1);
    }),
    it("Point3d.xUndefinedDefaultNotGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 0;
      const x: number = Point3d.x(xyz);
      expect(x).equal(defaultValue);
    }),
    it("Point3d.xUndefinedDefaultGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 5;
      const x: number = Point3d.x(xyz, defaultValue);
      expect(x).equal(defaultValue);
    });
});

describe("Point3d.y", () => {
  it("Point3d.yNotGiven", () => {
    const xyz: XYZProps = { x: 1, z: 3 };
    const y: number = Point3d.y(xyz);
    expect(y).equal(0);
  }),
    it("Point3d.yDefined", () => {
      const xyz: XYZProps = { x: 1, y: 2, z: 3 };
      const y: number = Point3d.y(xyz);
      expect(y).equal(2);
    }),
    it("Point3d.yUndefinedDefaultNotGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 0;
      const y: number = Point3d.y(xyz);
      expect(y).equal(defaultValue);
    }),
    it("Point3d.yUndefinedDefaultGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 5;
      const y: number = Point3d.y(xyz, defaultValue);
      expect(y).equal(defaultValue);
    });
});

describe("Point3d.z", () => {
  it("Point3d.zNotGiven", () => {
    const xyz: XYZProps = { x: 1, y: 2 };
    const z: number = Point3d.z(xyz);
    expect(z).equal(0);
  }),
    it("Point3d.zDefined", () => {
      const xyz: XYZProps = { x: 1, y: 2, z: 3 };
      const z: number = Point3d.z(xyz);
      expect(z).equal(3);
    }),
    it("Point3d.zUndefinedDefaultNotGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 0;
      const z: number = Point3d.z(xyz);
      expect(z).equal(defaultValue);
    }),
    it("Point3d.zUndefinedDefaultGiven", () => {
      let xyz: XYZProps | undefined;
      const defaultValue: number = 5;
      const z: number = Point3d.z(xyz, defaultValue);
      expect(z).equal(defaultValue);
    });
});

describe("Point3d.createFromPacked", () => {
  it("Point3d.createFromPacked", () => {
    const xyz = new Float64Array([1, 2, 3, 10, 15, 20]);
    const pointIndex: number = 100;
    const output: any = Point3d.createFromPacked(xyz, pointIndex);
    expect(output).to.deep.equal(undefined);
  });
});

describe("Point3d.createFromPackedXYZW", () => {
  it("Point3d.createFromPackedXYZW", () => {
    const xyz = new Float64Array([1, 2, 3, 10, 15, 20]);
    const pointIndex: number = 100;
    const output: any = Point3d.createFromPackedXYZW(xyz, pointIndex);
    expect(output).to.deep.equal(undefined);
  });
});

describe("Point3d.createArrayFromPackedXYZ", () => {
  it("Point3d.createArrayFromPackedXYZ", () => {
    const xyz = new Float64Array([1, 2, 3, 10, 15, 20, 50]);
    const point1: Point3d = Point3d.create(1, 2, 3);
    const point2: Point3d = Point3d.create(10, 15, 20);
    const arr: Point3d[] = Point3d.createArrayFromPackedXYZ(xyz);
    expect(arr[0]).to.deep.equal(point1);
    expect(arr[1]).to.deep.equal(point2);
  });
});

describe("Vector3d.setFromVector3d", () => {
  it("Vector3d.setFromVector3d", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const vectorZero: Vector3d = Vector3d.create(0, 0, 0);
    thisVector.setFromVector3d();
    expect(thisVector).to.deep.equal(vectorZero);
  });
});

describe("Vector3d.createArrayFromPackedXYZ", () => {
  it("Vector3d.createArrayFromPackedXYZ", () => {
    const xyz = new Float64Array([1, 2, 3, 10, 15, 20, 50]);
    const vector1: Vector3d = Vector3d.create(1, 2, 3);
    const vector2: Vector3d = Vector3d.create(10, 15, 20);
    const arr: Vector3d[] = Vector3d.createArrayFromPackedXYZ(xyz);
    expect(arr[0]).to.deep.equal(vector1);
    expect(arr[1]).to.deep.equal(vector2);
  });
});

describe("Vector3d.createVectorFromArray", () => {
  it("Vector3d.createVectorFromArrayNonDefaultZ", () => {
    const nums: any = [1, 2, 3];
    const expectedVector: Vector3d = Vector3d.create(1, 2, 3);
    const outputVector: Vector3d = Vector3d.createFrom(nums);
    expect(outputVector).to.deep.equal(expectedVector);
  }),
    it("Vector3d.createVectorFromArrayDefaultZ", () => {
      const nums: any = [1, 2];
      const expectedVector: Vector3d = Vector3d.create(1, 2, 0);
      const outputVector: Vector3d = Vector3d.createFrom(nums);
      expect(outputVector).to.deep.equal(expectedVector);
    });
});

describe("Vector3d.fractionOfProjectionToVector", () => {
  it("Vector3d.fractionOfProjectionToVector", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const targetVector: Vector3d = Vector3d.create(0, 0, 0);
    const fraction: number = thisVector.fractionOfProjectionToVector(targetVector);
    expect(fraction).equal(0);
  });
});

describe("Vector3d.scaleToLength", () => {
  it("Vector3d.scaleToLength", () => {
    const thisVector: Vector3d = Vector3d.create(0, 0, 0);
    const length: number = 10;
    const output: any = thisVector.scaleToLength(length);
    expect(output).equal(undefined);
  });
});

describe("Vector3d.normalize", () => {
  it("Vector3d.normalizeWithDefault", () => {
    const thisVector: Vector3d = Vector3d.create(0, 0, 0);
    const expectedVector: Vector3d = Vector3d.create(1, 0, 0);
    const output: Vector3d = thisVector.normalizeWithDefault(0, 0, 0);
    expect(output).to.deep.equal(expectedVector);
  });

  it("Vector3d.createNormalized", () => {
    const ck = new bsiChecker.Checker();
    const unitVec = Vector3d.create(Math.SQRT1_2, Math.SQRT1_2);
    const vec = Vector3d.createNormalized(3, 3)!;
    ck.testVector3d(unitVec, vec, "expect normalized vector");
    vec.setZero();
    ck.testVector3d(unitVec, Vector3d.createNormalized(1, 1, 0, vec)!, "expect normalized vector with initialized result");
    ck.testUndefined(Vector3d.createNormalized(), "expect undefined when input is zero vector");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Vector3d.rotate90", () => {
  it("Vector3d.rotate90CCWXY", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 0);
    const rotatedVector: Vector3d = Vector3d.create(-2, 1, 0);
    const outputVector: Vector3d = thisVector.rotate90CCWXY();
    expect(outputVector).to.deep.equal(rotatedVector);
  }),
    it("Vector3d.rotate90CWXY", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 0);
      const rotatedVector: Vector3d = Vector3d.create(2, -1, 0);
      const outputVector: Vector3d = thisVector.rotate90CWXY();
      expect(outputVector).to.deep.equal(rotatedVector);
    });
});

describe("Vector3d.dotProductStartEndXYZW", () => {
  it("Vector3d.dotProductStartEndXYZW", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const pointA: Point3d = Point3d.create(4, 5, 6);
    const weight: number = 0;
    const output: number = thisVector.dotProductStartEndXYZW(pointA, 10, 15, 20, weight);
    expect(output).equal(0);
  });
});

describe("Vector3d.angleFromPerpendicular", () => {
  it("Vector3d.angleFromPerpendicularPositiveDotProduct", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const planeNormal: Vector3d = Vector3d.create(1, 1, 1);
    const output: Angle = thisVector.angleFromPerpendicular(planeNormal);
    expect(output.radians).greaterThan(0);
    expect(output.radians).lessThan(Angle.piRadians);
  }),
    it("Vector3d.angleFromPerpendicularNegativeDotProduct", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const planeNormal: Vector3d = Vector3d.create(-1, -1, -1);
      const output: Angle = thisVector.angleFromPerpendicular(planeNormal);
      expect(output.radians).greaterThan(-Angle.piRadians);
      expect(output.radians).lessThan(0);
    });
});

describe("Vector3d.planarRadiansTo", () => {
  it("Vector3d.planarRadiansTo", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const vectorB: Vector3d = Vector3d.create(4, 5, 6);
    const planeNormal: Vector3d = Vector3d.create(0, 0, 0);
    const output: number = thisVector.planarRadiansTo(vectorB, planeNormal);
    expect(output).equal(0);
  });
});

describe("Vector3d.isParallelTo", () => {
  it("Vector3d.isParallelToWithZeroVector", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const other: Vector3d = Vector3d.create(0, 0, 0);
    const output: boolean = thisVector.isParallelTo(other);
    expect(output).equal(false);
  }),
    it("Vector3d.isParallelToTrueWithGivenTolerances", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const other: Vector3d = Vector3d.create(1.01, 2.01, 3.01);
      const options: PerpParallelOptions = { radianSquaredTol: 1, distanceSquaredTol: 1 };
      const output: boolean = thisVector.isParallelTo(other, undefined, undefined, options);
      expect(output).equal(true);
    }),
    it("Vector3d.isParallelToFalseWithGivenTolerances", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const other: Vector3d = Vector3d.create(1.01, 2.01, 3.01);
      const options: PerpParallelOptions = { radianSquaredTol: 1e-10, distanceSquaredTol: 1e-10 };
      const output: boolean = thisVector.isParallelTo(other, undefined, undefined, options);
      expect(output).equal(false);
    });
});

describe("Vector3d.isPerpendicularTo", () => {
  it("Vector3d.isPerpendicularToWithZeroVector", () => {
    const thisVector: Vector3d = Vector3d.create(1, 2, 3);
    const other: Vector3d = Vector3d.create(0, 0, 0);
    const output: boolean = thisVector.isPerpendicularTo(other);
    expect(output).equal(false);
  }),
    it("Vector3d.isPerpendicularToTrueWithGivenTolerances", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const other: Vector3d = Vector3d.create(-2.01, 1.01, 3.01);
      const options: PerpParallelOptions = { radianSquaredTol: 1, distanceSquaredTol: 1 };
      const output: boolean = thisVector.isPerpendicularTo(other, undefined, options);
      expect(output).equal(true);
    }),
    it("Vector3d.isPerpendicularToFalseWithGivenTolerances", () => {
      const thisVector: Vector3d = Vector3d.create(1, 2, 3);
      const other: Vector3d = Vector3d.create(-2.01, 1.01, 3.01);
      const options: PerpParallelOptions = { radianSquaredTol: 1e-10, distanceSquaredTol: 1e-10 };
      const output: boolean = thisVector.isPerpendicularTo(other, undefined, options);
      expect(output).equal(false);
    });
});

describe("Geometry", () => {
  it("AxisIndex", () => {
    const ck = new bsiChecker.Checker();
    const axisX: AxisIndex = AxisIndex.X;
    const axisY: AxisIndex = AxisIndex.Y;
    const axisZ: AxisIndex = AxisIndex.Z;
    ck.testExactNumber(AxisOrder.XYZ,
      Geometry.axisIndexToRightHandedAxisOrder(axisX), "X==>XYZ",
    );
    ck.testExactNumber(AxisOrder.YZX,
      Geometry.axisIndexToRightHandedAxisOrder(axisY), "Y==>YZX",
    );
    ck.testExactNumber(AxisOrder.ZXY,
      Geometry.axisIndexToRightHandedAxisOrder(axisZ), "X==>ZXY",
    );

    for (const phase of [0, 1, 2, 500, -10, -8, -2, -1]) {
      ck.testExactNumber(AxisOrder.XYZ,
        Geometry.axisIndexToRightHandedAxisOrder(3 * phase), "X==>XYZ",
      );
      ck.testExactNumber(AxisOrder.YZX,
        Geometry.axisIndexToRightHandedAxisOrder(3 * phase + 1), "Y==>YZX",
      );
      ck.testExactNumber(AxisOrder.ZXY,
        Geometry.axisIndexToRightHandedAxisOrder(3 * phase + 2), "X==>ZXY",
      );
      for (const baseAxis of [0, 1, 2]) {
        const axis = phase * 3 + baseAxis;
        ck.testExactNumber(baseAxis, Geometry.cyclic3dAxis(axis), "Cyclic axis reduction");
      }
    }
    expect(ck.getNumErrors()).equals(0);
  }),
    it("lexical", () => {
      const ck = new bsiChecker.Checker();
      const pointI = Point3d.create();
      const pointJ = Point3d.create();
      const lattice = Sample.createPoint3dLattice(-1, 2, 1);
      for (let i = 0; i < lattice.length; i++) {
        ck.testExactNumber(0, Geometry.lexicalXYZLessThan(lattice[i], lattice[i]));

        for (let j = i + 1; j < lattice.length; j++) {
          pointI.set(lattice[i].z, lattice[i].y, lattice[i].x);
          pointJ.set(lattice[j].z, lattice[j].y, lattice[j].x);
          ck.testExactNumber(-1, Geometry.lexicalXYZLessThan(pointI, pointJ));
          ck.testExactNumber(1, Geometry.lexicalXYZLessThan(pointJ, pointI));
        }
      }
      expect(ck.getNumErrors()).equals(0);
    });
});

import { expect } from "chai";
import { TextAnnotation, TextAnnotationAnchor } from "../../annotation/TextAnnotation";
import { Angle, AxisIndex, Matrix3d, Point3d, Range2d, Range3d, YawPitchRollAngles } from "@itwin/core-geometry";

describe("TextAnnotation", () => {
  describe("computeAnchorPoint", () => {
    function expectAnchor(x: number, y: number, horizontal: "left" | "right" | "center", vertical: "top" | "bottom" | "middle"): void {
      const annotation = TextAnnotation.fromJSON({
        anchor: { horizontal, vertical },
      });

      const extents = { x: 20, y: 10 };
      const actual = annotation.computeAnchorPoint(extents);
      expect(actual.x).to.equal(x);
      expect(actual.y).to.equal(y);
    }

    it("should compute anchor point based on anchor settings and text block dimensions", () => {
      expectAnchor(0, 0, "left", "top");
      expectAnchor(0, -10, "left", "bottom");
      expectAnchor(0, -5, "left", "middle");
      expectAnchor(20, 0, "right", "top");
      expectAnchor(20, -10, "right", "bottom");
      expectAnchor(20, -5, "right", "middle");
      expectAnchor(10, 0, "center", "top");
      expectAnchor(10, -10, "center", "bottom");
      expectAnchor(10, -5, "center", "middle");
    });
  });

  describe("computeTransform", () => {
    function expectTransformedRange(expectedRange: [number, number, number, number], options?: {
      anchor?: TextAnnotationAnchor;
      origin?: number[];
      rotation?: number;
    }): void {
      const annotation = TextAnnotation.fromJSON({
        anchor: options?.anchor,
        origin: options?.origin,
        orientation: options?.rotation ? new YawPitchRollAngles(Angle.createDegrees(options.rotation)) : undefined,
      });

      // NB: In TextBlock coordinates, the origin is at the top-left.
      const dimensions = { x: 20, y: 10 };
      const extents = new Range3d(0, -dimensions.y, 0, dimensions.x, 0, 0);
      const transform = annotation.computeTransform(dimensions);
      const expected = Range3d.createRange2d(new Range2d(expectedRange[0], expectedRange[1], expectedRange[2], expectedRange[3]));
      const actual = transform.multiplyRange(extents);

      // console.log(`anchor ${JSON.stringify(annotation.computeAnchorPoint(extents))}`);
      // console.log(`transform ${JSON.stringify(transform)}`);
      // console.log(`transformed ${JSON.stringify(actual.toJSON())}`);
      // const topRight = new Point3d(20, 0, 0);
      // transform.multiplyPoint3d(topRight, topRight);
      // console.log(`topRight ${JSON.stringify(topRight)}`);
      // const bottomRight = new Point3d(20, -10, 0);
      // transform.multiplyPoint3d(bottomRight, bottomRight);
      // console.log(`bottomRight ${JSON.stringify(bottomRight)}`);
      // const topLeft = new Point3d(0, 0, 0);
      // transform.multiplyPoint3d(topLeft, topLeft);
      // console.log(`topLeft ${JSON.stringify(topLeft)}`);
      

      // expect(actual.low.x).to.equal(expected.low.x);
      // expect(actual.low.y).to.equal(expected.low.y);
      // expect(actual.low.z).to.equal(expected.low.z);
      // expect(actual.high.x).to.equal(expected.high.x);
      // expect(actual.high.y).to.equal(expected.high.y);
      // expect(actual.high.z).to.equal(expected.high.z);

      expect(actual.isAlmostEqual(expected)).to.equal(true, `expected ${JSON.stringify(expected)} actual ${JSON.stringify(actual)}`);
    }

    const verticals = ["top", "middle", "bottom"] as const;
    const horizontals = ["left", "center", "right"] as const;

    it("should produce identity transform for identity orientation and zero origin", () => {
      for (const vertical of verticals) {
        for (const horizontal of horizontals) {
          expectTransformedRange([0, -10, 20, 0], { anchor: { vertical, horizontal } });
        }
      }
    });

    it("should translate relative to anchor point", () => {
      for (const vertical of verticals) {
        for (const horizontal of horizontals) {
          expectTransformedRange([-5, 10, 15, 20], { origin: [-5, 20], anchor: { vertical, horizontal } });
        }
      }
    });

    it("should rotate about fixed anchor point", () => {
      expectTransformedRange([0, 0, 10, 20], {
        anchor: { horizontal: "left", vertical: "top" },
        rotation: 90,
      });
      expectTransformedRange([-10, -10, 0, 10], {
        anchor: { horizontal: "left", vertical: "bottom" },
        rotation: 90,
      });
      expectTransformedRange([-5, -5, 5, 15], {
        anchor: { horizontal: "left", vertical: "middle" },
        rotation: 90,
      });

      expectTransformedRange([5, -15, 15, 5], {
        anchor: { horizontal: "center", vertical: "middle" },
        rotation: 90,
      });
      expectTransformedRange([10, -10, 20, 10], {
        anchor: { horizontal: "center", vertical: "top"},
        rotation: 90,
      });
      expectTransformedRange([0, -20, 10, 0], {
        anchor: { horizontal: "center", vertical: "bottom" },
        rotation: 90,
      });

      expectTransformedRange([20, -20, 30, 0], {
        anchor: { horizontal: "right", vertical: "top" },
        rotation: 90,
      });
      expectTransformedRange([10, -30, 20, -10], {
        anchor: { horizontal: "right", vertical: "bottom" },
        rotation: 90,
      });
      expectTransformedRange([15, -25, 25, -5], {
        anchor: { horizontal: "right", vertical: "middle" },
        rotation: 90,
      });
    });

    it("should apply translation after rotation about fixed anchor point", () => {
      expectTransformedRange([0, -5, 10, 15], {
        anchor: { horizontal: "center", vertical: "middle" },
        rotation: 90,
        origin: [-5, 10],
      });
      expectTransformedRange([-11, -8, -1, 12], {
        anchor: { horizontal: "left", vertical: "bottom" },
        rotation: 90,
        origin: [-1, 2],
      });
      expectTransformedRange([20, 80, 30, 100], {
        anchor: { horizontal: "right", vertical: "top" },
        rotation: 90,
        origin: [0, 100],
      });
    });
  });
});

import { expect } from "chai";
import { TextAnnotation, TextAnnotationAnchor } from "../../annotation/TextAnnotation";
import { Angle, AxisIndex, Matrix3d, Point3d, Range2d, Range3d, YawPitchRollAngles } from "@itwin/core-geometry";

describe.only("TextAnnotation", () => {
  describe("computeAnchorPoint", () => {
    function expectAnchor(x: number, y: number, horizontal: "left" | "right" | "center", vertical: "top" | "bottom" | "middle"): void {
      const annotation = TextAnnotation.fromJSON({
        anchor: { horizontal, vertical },
      });

      const extents = new Range2d(0, 0, 20, 10);
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

      const extents = new Range2d(0, 0, 20, 10);
      const transform = annotation.computeTransform(extents);
      const expected = Range3d.createRange2d(new Range2d(expectedRange[0], expectedRange[1], expectedRange[2], expectedRange[3]));
      const actual = transform.multiplyRange(Range3d.createRange2d(extents));

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
      

      expect(actual.low.x).to.equal(expected.low.x);
      expect(actual.low.y).to.equal(expected.low.y);
      expect(actual.low.z).to.equal(expected.low.z);
      expect(actual.high.x).to.equal(expected.high.x);
      expect(actual.high.y).to.equal(expected.high.y);
      expect(actual.high.z).to.equal(expected.high.z);
    }

    const verticals = ["top", "middle", "bottom"] as const;
    const horizontals = ["left", "center", "right"] as const;

    it("should produce identity transform for identity orientation and zero origin", () => {
      for (const vertical of verticals) {
        for (const horizontal of horizontals) {
          expectTransformedRange([0, 0, 20, 10], { anchor: { vertical, horizontal } });
        }
      }
    });

    it("should translate relative to anchor point", () => {
      for (const vertical of verticals) {
        for (const horizontal of horizontals) {
          expectTransformedRange([-5, 20, 15, 30], { origin: [-5, 20], anchor: { vertical, horizontal } });
        }
      }
    });

    it("should rotate about fixed anchor point", () => {
      expectTransformedRange([-10, -10, 0, 10], {
        anchor: { horizontal: "left", vertical: "bottom" },
        rotation: 90,
      });
    });

    it("should apply translation after rotation about fixed anchor point", () => {

    });
  });
});

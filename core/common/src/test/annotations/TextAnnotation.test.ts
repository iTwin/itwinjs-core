import { describe, expect, it } from "vitest";
import { TextAnnotation, TextAnnotationAnchor } from "../../annotation/TextAnnotation";
import { Angle, Point3d, Range2d, Range3d, YawPitchRollAngles } from "@itwin/core-geometry";

describe("TextAnnotation", () => {
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
      expectAnchor(0, 10, "left", "top");
      expectAnchor(0, 0, "left", "bottom");
      expectAnchor(0, 5, "left", "middle");
      expectAnchor(20, 10, "right", "top");
      expectAnchor(20, 0, "right", "bottom");
      expectAnchor(20, 5, "right", "middle");
      expectAnchor(10, 10, "center", "top");
      expectAnchor(10, 0, "center", "bottom");
      expectAnchor(10, 5, "center", "middle");
    });
  });

  describe("computeTransform", () => {
    const verticals = ["top", "middle", "bottom"] as const;
    const horizontals = ["left", "center", "right"] as const;

    it("aligns anchor point with origin prior to translation by offset", () => {
      const extents = new Range2d(0, -10, 20, 0);

      for (const horizontal of horizontals) {
        for (const vertical of verticals) {
          const annotation = TextAnnotation.fromJSON({ anchor: { horizontal, vertical } });

          const expectAnchorAtOrigin = () => {
            const transform = annotation.computeTransform(extents);
            const anchor = annotation.computeAnchorPoint(extents);
            const transformed = transform.multiplyPoint3d(anchor);
            const expected = annotation.offset;
            expect(transformed.isAlmostEqual(expected)).to.equal(true, `expected ${JSON.stringify(transformed.toJSON())} to equal ${JSON.stringify(expected.toJSON())}`);
          };

          // No offset nor rotation
          expectAnchorAtOrigin();

          // Rotation only
          annotation.orientation = new YawPitchRollAngles(Angle.createDegrees(45));
          expectAnchorAtOrigin();

          // Offset only
          annotation.orientation = new YawPitchRollAngles();;
          annotation.offset = new Point3d(4, -6, 0);
          expectAnchorAtOrigin();

          // Offset and rotation
          annotation.orientation = new YawPitchRollAngles(Angle.createDegrees(45));
          expectAnchorAtOrigin();
        }
      }
    });

    function expectTransformedRange(expectedRange: [number, number, number, number], options?: {
      anchor?: TextAnnotationAnchor;
      origin?: number[];
      rotation?: number;
    }): void {
      const annotation = TextAnnotation.fromJSON({
        anchor: options?.anchor,
        offset: options?.origin,
        orientation: options?.rotation ? new YawPitchRollAngles(Angle.createDegrees(options.rotation)) : undefined,
      });

      // NB: In TextBlock coordinates, the origin is at the top-left.
      const dimensions = { x: 20, y: 10 };
      const extents = new Range3d(0, -dimensions.y, 0, dimensions.x, 0, 0);
      const transform = annotation.computeTransform(new Range2d(0, -dimensions.y, dimensions.x, 0));

      // The anchor point is aligned with the origin (prior to translating by offset).
      // Our tests were written before that was implemented.
      // Keep the tests simple by subtracting the anchor from our expected range.
      const anchor = annotation.computeAnchorPoint(new Range2d(0, -dimensions.y, dimensions.x, 0));
      const expected = Range3d.createRange2d(new Range2d(expectedRange[0], expectedRange[1], expectedRange[2], expectedRange[3]));
      expected.low.x -= anchor.x;
      expected.high.x -= anchor.x;
      expected.low.y -= anchor.y;
      expected.high.y -= anchor.y;

      const actual = transform.multiplyRange(extents);
      expect(actual.isAlmostEqual(expected)).to.equal(true, `expected ${JSON.stringify(expected)} actual ${JSON.stringify(actual)}`);
    }

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

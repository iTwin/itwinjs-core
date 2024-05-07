import { expect } from "chai";
import { TextAnnotation } from "../../annotation/TextAnnotation";
import { Point3d, Range2d } from "@itwin/core-geometry";

describe("TextAnnotation", () => {

  it("should compute anchor point with center and middle anchor", () => {
    const textAnnotation = TextAnnotation.fromJSON({
      anchor: { horizontal: "center", vertical: "middle" },
    });
    const textBlockExtents = new Range2d(0, 0, 100, 50);
    const result = textAnnotation.computeAnchorPoint(textBlockExtents);
    expect(result).to.deep.equal(new Point3d(50, -25, 0));
  });

  it("should compute anchor point with right and bottom anchor", () => {
    const textAnnotation = TextAnnotation.fromJSON({
      anchor: { horizontal: "right", vertical: "bottom" },
    });
    const textBlockExtents = new Range2d(0, 0, 100, 50);
    const result = textAnnotation.computeAnchorPoint(textBlockExtents);
    expect(result).to.deep.equal(new Point3d(100, -50, 0));
  });

  it("should compute anchor point with default anchor", () => {
    const textAnnotation = TextAnnotation.fromJSON({ });
    const textBlockExtents = new Range2d(0, 0, 100, 50);
    const result = textAnnotation.computeAnchorPoint(textBlockExtents);
    expect(result).to.deep.equal(new Point3d(0, 0, 0));
  });
});

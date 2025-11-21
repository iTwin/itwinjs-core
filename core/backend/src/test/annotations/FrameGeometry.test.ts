/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CurvePrimitive, Geometry, Point3d, Range2d, Transform, Vector3d } from "@itwin/core-geometry";
import { ColorDef, GeometryParams, textAnnotationFrameShapes, TextFrameStyleProps } from "@itwin/core-common";
import { appendFrameToBuilder, computeFrame } from "../../annotations/FrameGeometry";
import { Id64 } from "@itwin/core-bentley";
import { MockBuilder } from "../AnnotationTestUtils";

function isContinuous(geometries: CurvePrimitive[]): boolean {
  return geometries.every((current, index) => {
    // If the index is 0, get the last geometry in the list to see if they connect and form a loop
    const previous = (index === 0) ? geometries[geometries.length - 1] : geometries[index - 1];

    return previous.endPoint().isAlmostEqual(current.startPoint(), Geometry.smallMetricDistance);
  });
}

describe("FrameGeometry", () => {
  const defaultRange = Range2d.createXYXY(0, 0, 10, 20);
  const defaultTransform = Transform.createIdentity();
  const defaultParams = new GeometryParams(Id64.invalid);

  describe("appendFrameToBuilder", () => {
    it("should not append frame if shape is undefined or 'none'", () => {
      const builder = new MockBuilder();
      expect(appendFrameToBuilder(builder, { shape: undefined }, defaultRange, defaultTransform, defaultParams)).to.be.false;
      expect(appendFrameToBuilder(builder, { shape: "none" }, defaultRange, defaultTransform, defaultParams)).to.be.false;
      expect(appendFrameToBuilder(builder, { shape: "none", fillColor: ColorDef.green.toJSON() }, defaultRange, defaultTransform, defaultParams)).to.be.false;
    });

    it("should append only a frame", () => {
      const builder = new MockBuilder();
      const frame: TextFrameStyleProps = { shape: "rectangle" };
      const result = appendFrameToBuilder(builder, frame, defaultRange, defaultTransform, defaultParams);
      expect(result).to.be.true;
      expect(builder.geometries.length).to.be.equal(1);
    });

    it("should append a frame and fill", () => {
      const builder = new MockBuilder();
      const frame: TextFrameStyleProps = { shape: "rectangle", fillColor: ColorDef.green.toJSON() };
      const result = appendFrameToBuilder(builder, frame, defaultRange, defaultTransform, defaultParams);
      expect(result).to.be.true;
      expect(builder.geometries.length).to.be.equal(2);
    });

    it("should set fill and border colors from frame", () => {
      const builder = new MockBuilder();
      const frame: TextFrameStyleProps = {
        shape: "rectangle",
        fillColor: ColorDef.blue.toJSON(),
        borderColor: ColorDef.red.toJSON(),
        borderWeight: 3,
      };
      appendFrameToBuilder(builder, frame, defaultRange, defaultTransform, defaultParams);
      const params = builder.params[builder.params.length - 1];
      expect(params.fillColor?.tbgr).to.equal(ColorDef.blue.tbgr);
      expect(params.lineColor?.tbgr).to.equal(ColorDef.red.tbgr);
      expect(params.weight).to.equal(3);
    });

  });
  describe("computeGeometry", () => {
    const shapes = textAnnotationFrameShapes.filter(shape => shape !== "none");
    it("should compute different frame shapes and they should be continuous", () => {
      for (const shape of shapes) {
        const frame = computeFrame({ frame: shape, range: defaultRange, transform: defaultTransform });
        expect(frame).to.exist;

        const curvePrimitives = frame.collectCurvePrimitives(undefined, true);

        if (curvePrimitives.length > 1) {
          // The start point of a given segment should be the end point of the previous segment
          const isContinuousShape = isContinuous(frame.collectCurvePrimitives(undefined, true))
          expect(isContinuousShape, `Frame shape ${shape} should be continuous`).to.be.true;
        }
      }
    });

    it("should apply transform", () => {
      const origin = Point3d.create(5, 6, 7);
      const vector = Vector3d.create(1, 2, 3);
      vector.tryNormalizeInPlace();
      const transform = Transform.createRigidFromOriginAndVector(origin, vector)!; // This transform is something I made up for this test. It should exist.

      for (const shape of shapes) {
        const rotatedFrame = computeFrame({ frame: shape, range: defaultRange, transform });
        const unRotatedFrame = computeFrame({ frame: shape, range: defaultRange, transform: defaultTransform });

        const control = unRotatedFrame.cloneTransformed(transform)!; // This transform is something I made up for this test. It should exist.
        expect(rotatedFrame.isAlmostEqual(control), `Rotated frame for shape ${shape} should match control`).to.be.true;
      }
    });
  });
});
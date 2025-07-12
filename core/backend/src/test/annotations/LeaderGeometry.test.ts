/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryParams, LineBreakRun, TextAnnotation, TextAnnotationLeader, TextBlock, TextFrameStyleProps, TextRun, TextStyleSettings } from "@itwin/core-common";
import { LineString3d, Point3d, Range2d, YawPitchRollAngles } from "@itwin/core-geometry";
import { appendLeadersToBuilder, computeElbowDirection, computeFrame, computeLeaderAttachmentPoint } from "../../core-backend";
import { Id64 } from "@itwin/core-bentley";
import { doLayout, MockBuilder } from "../AnnotationTestUtils";

describe("LeaderGeometry", () => {
  let builder: MockBuilder;
  let defaultParams: GeometryParams;

  const textBlock = TextBlock.create({ styleName: "", styleOverrides: { fontName: "Arial" } });
  textBlock.appendRun(TextRun.create({ content: "Hello", styleName: "", styleOverrides: { fontName: "Arial" } }));
  textBlock.appendRun(LineBreakRun.create({
    styleName: "",
    styleOverrides: { fontName: "Arial" },
  }));
  textBlock.appendRun(TextRun.create({ content: "World", styleName: "", styleOverrides: { fontName: "Arial" } }));

  const frame: TextFrameStyleProps = { borderWeight: 1, shape: "rectangle" };

  const annotation = TextAnnotation.fromJSON({
    textBlock: textBlock.toJSON(),
    anchor: { horizontal: "left", vertical: "top" },
    orientation: YawPitchRollAngles.createDegrees(0, 0, 0).toJSON(),
    offset: { x: 0, y: 0 },
    frame
  });

  const layout = doLayout(textBlock, {
    findTextStyle: (name: string) => TextStyleSettings.fromJSON(name === "block" ? { lineSpacingFactor: 12, fontName: "block" } : { lineSpacingFactor: 99, fontName: "run" }),
    findFontId: () => 0,
  });

  const range = Range2d.fromJSON(layout.range);
  const transform = annotation.computeTransform(range);
  const frameCurve = computeFrame({ frame: frame.shape === "none" ? "rectangle" : (frame.shape ?? "rectangle"), range: layout.range, transform });

  beforeEach(() => {
    builder = new MockBuilder();
    defaultParams = new GeometryParams(Id64.invalid);
  });

  describe("appendLeaderToBuilder", () => {
    it("should append a leader to the builder", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "Nearest" }
        }
      ]
      const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, frame);
      expect(result).to.be.true;
      expect(builder.geometries.length).to.be.greaterThan(0);
    });

    it("should append multiple leaders to the builder", () => {
      const leaders: TextAnnotationLeader[] = [{ startPoint: Point3d.create(20, 20, 0), attachment: { mode: "Nearest" } },
      { startPoint: Point3d.create(10, 0, 0), attachment: { mode: "Nearest" } }];
      const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, frame);
      expect(result).to.be.true;
      expect(builder.geometries.length).to.be.greaterThanOrEqual(2);
    });

    it("should have intermediate points in geometry", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "Nearest" },
          intermediatePoints: [Point3d.create(15, 15, 0), Point3d.create(20, 20, 0)]
        }
      ];
      const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, frame);
      expect(result).to.be.true;
      const geometries = builder.geometries;
      const leaderSegments = geometries[0] as LineString3d;
      expect(leaderSegments.points.length).to.be.equal(4); // start + 2 intermediate + end
    });

    it("should have elbow in the geometry", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: {
            leader: {
              wantElbow: true,
              elbowLength: 5
            }
          }
        }
      ];
      const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, frame);
      expect(result).to.be.true;
      const geometries = builder.geometries;
      const leaderSegments = geometries[0] as LineString3d;
      expect(leaderSegments.points.length).to.be.equal(3); // start + elbowPoint + end
    });
  })

  describe("computeElbowDirection", () => {
    it("should return elbow direction", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: {
            leader: {
              wantElbow: true,
              elbowLength: 5
            }
          }
        }
      ];

      const attachmentPoint = computeLeaderAttachmentPoint(leaders[0], frameCurve, layout, transform);
      if (attachmentPoint) {
        const elbowDirection = computeElbowDirection(attachmentPoint, frameCurve,
          leaders[0].styleOverrides?.leader?.elbowLength ?? 1);
        expect(elbowDirection).to.exist;
      }
    });

    it("should return undefined if elbow is tangential", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "Nearest" },
          styleOverrides: {
            leader: {
              wantElbow: true,
              elbowLength: 5
            }
          }
        }
      ];

      const attachmentPoint = computeLeaderAttachmentPoint(leaders[0], frameCurve, layout, transform);
      if (attachmentPoint) {
        const elbowDirection = computeElbowDirection(attachmentPoint, frameCurve,
          leaders[0].styleOverrides?.leader?.elbowLength ?? 1);
        expect(elbowDirection).to.be.undefined;
      }
    });
  })

  describe("computeLeaderAttachmentPoint", () => {
    it("should return correct attachmentPoint for 'Nearest' mode", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(-20, 0, 0),
          attachment: { mode: "Nearest" }
        }
      ];
      const attachmentPoint = computeLeaderAttachmentPoint(leaders[0], frameCurve, layout, transform);
      expect(attachmentPoint).to.exist;
      expect(attachmentPoint!.isAlmostEqual(Point3d.create(0, 0, 0))).to.be.true;
    });

    it("should return correct attachmentPoint for 'Keypoint' mode", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(-20, 0, 0),
          attachment: { mode: "KeyPoint", curveIndex: 0, fraction: 0 }
        }
      ];
      const attachmentPoint = computeLeaderAttachmentPoint(leaders[0], frameCurve, layout, transform);
      expect(attachmentPoint).to.exist;
      expect(attachmentPoint?.y).to.be.equal(range.low.y); // expected to be at the bottom of the TextBlock
    });

    it("should return correct attachmentPoint for 'TextPoint' mode", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(-20, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" }
        }
      ];
      const attachmentPoint = computeLeaderAttachmentPoint(leaders[0], frameCurve, layout, transform);
      expect(attachmentPoint).to.exist;
      const topY = range.high.y;
      const middleY = (range.low.y + range.high.y) / 2;
      expect(attachmentPoint!.y).to.be.within(middleY, topY); // expected to be in the upper half of the TextBlock
    });
  })

})

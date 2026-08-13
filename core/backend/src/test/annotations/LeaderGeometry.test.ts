/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef, GeometryParams, LineBreakRun, TargetPointShape, targetPointShapes, TerminatorShape, terminatorShapes, TextAnnotation, TextAnnotationLeader, TextBlock, TextFrameStyleProps, TextRun, TextStyleSettings } from "@itwin/core-common";
import { Arc3d, LineSegment3d, LineString3d, Point3d, Range2d, YawPitchRollAngles } from "@itwin/core-geometry";
import { appendLeadersToBuilder, computeElbowDirection, computeFrame, computeLeaderAttachmentPoint, TextStyleResolver } from "../../core-backend";
import { Id64, Id64String } from "@itwin/core-bentley";
import { doLayout, MockBuilder } from "../AnnotationTestUtils";

describe("LeaderGeometry", () => {
  let builder: MockBuilder;
  let defaultParams: GeometryParams;

  const textBlock = TextBlock.create({ styleOverrides: { font: { name: "Arial" }, color: ColorDef.black.toJSON(), leader: { wantElbow: false } } });
  textBlock.appendRun(TextRun.create({ content: "Hello", styleOverrides: { font: { name: "Arial" } } }));
  textBlock.appendRun(LineBreakRun.create({
    styleOverrides: { font: { name: "Arial" } },
  }));
  textBlock.appendRun(TextRun.create({ content: "World", styleOverrides: { font: { name: "Arial" } } }));

  const frame: TextFrameStyleProps = { borderWeight: 1, shape: "rectangle" };

  const annotation = TextAnnotation.fromJSON({
    textBlock: textBlock.toJSON(),
    anchor: { horizontal: "left", vertical: "top" },
    orientation: YawPitchRollAngles.createDegrees(0, 0, 0).toJSON(),
    offset: { x: 0, y: 0 },
  });

  const findTextStyle = (id: Id64String) => TextStyleSettings.fromJSON(id === "0x34" ? { lineSpacingFactor: 12, font: { name: "block" }, frame } : { lineSpacingFactor: 99, font: { name: "run" }, frame });
  const textStyleResolver = new TextStyleResolver({
    textBlock,
    textStyleId: "0x34",
    iModel: {} as any,
    findTextStyle,
  });
  const layout = doLayout(textBlock, {
    textStyleId: "0x34",
    findTextStyle,
    findFontId: () => 0,
  });
  const scaleFactor = 1;


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
      const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
      expect(result).to.be.true;
      const params = builder.params[builder.params.length - 1];
      expect(builder.params.length).to.be.equal(1);
      expect(params.lineColor).to.be.equal(ColorDef.black); // textBlock color
      expect(builder.geometries.length).to.be.equal(2); // One LineString3d for leadersLines and one for terminators
      for (const geometryEntry of builder.geometries) {
        expect(geometryEntry).to.be.instanceOf(LineString3d);
      }
    });

    it("should append multiple leaders to the builder", () => {
      const leaders: TextAnnotationLeader[] = [{ startPoint: Point3d.create(20, 20, 0), attachment: { mode: "Nearest" } },
      { startPoint: Point3d.create(10, 0, 0), attachment: { mode: "Nearest" } }];
      const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
      expect(result).to.be.true;
      expect(builder.params.length).to.be.equal(2); // One for each leader
      expect(builder.geometries.length).to.be.equal(4); // Two LineString3d for leadersSegments and two for terminators
      for (const geometryEntry of builder.geometries) {
        expect(geometryEntry).to.be.instanceOf(LineString3d);
      }
    });

    it("should have intermediate points in geometry", () => {
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "Nearest" },
          intermediatePoints: [Point3d.create(15, 15, 0), Point3d.create(20, 20, 0)]
        }
      ];
      const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
      expect(result).to.be.true;
      const geometries = builder.geometries;
      const leaderLines = geometries[0] as LineString3d;
      expect(leaderLines.points.length).to.be.equal(4); // start + 2 intermediate + end
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
      const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
      expect(result).to.be.true;
      const geometries = builder.geometries;
      const leaderLines = geometries[0] as LineString3d;
      expect(leaderLines.points.length).to.be.equal(3); // start + elbowPoint + end
    });

    describe("should return correct geometry for different attachment modes", () => {
      const leaders: TextAnnotationLeader[] = [{
        startPoint: Point3d.create(10, 0, 0),
        attachment: { mode: "TextPoint", position: "TopLeft" }
      }, {
        startPoint: Point3d.create(20, 20, 0),
        attachment: { mode: "KeyPoint", curveIndex: 0, fraction: 0.5 }
      }, {
        startPoint: Point3d.create(30, 30, 0),
        attachment: { mode: "Nearest" }
      }]

      for (const leader of leaders) {
        builder = new MockBuilder();
        it(`${leader.attachment.mode}`, () => {
          const attachmentPoint = computeLeaderAttachmentPoint(leader, frameCurve, layout, transform);
          if (!attachmentPoint) {
            expect.fail("Attachment point should not be undefined");
          }
          const result = appendLeadersToBuilder(builder, [leader], layout, transform, defaultParams, textStyleResolver, scaleFactor);
          expect(result).to.be.true;
          const leaderLines = builder.geometries[0] as LineString3d;
          // The last point in the geometry is the point on frame where leader is supposed to be attached.
          expect(leaderLines.points[leaderLines.points.length - 1].isAlmostEqual(attachmentPoint)).to.be.true;
        })
      }
    })
    describe("should return correct geometry for different styleOverrides", () => {
      const textHeight = TextStyleSettings.defaultProps.textHeight;
      const leaders: TextAnnotationLeader[] = [
        {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: {
            leader: {
              wantElbow: true,
              elbowLength: 5,
              color: ColorDef.red.toJSON(),
              terminatorShape: terminatorShapes[0],
              terminatorHeightFactor: 2,
              terminatorWidthFactor: 2,
            }
          }
        }
      ];

      it("should apply color overrides", () => {
        const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        const params = builder.params[builder.params.length - 1];
        expect(params.lineColor).to.equal(ColorDef.red);
      });

      it("should apply terminator size overrides", () => {
        const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        const terminatorLines = builder.geometries[1] as LineString3d;
        const terminatorLength = LineSegment3d.create(terminatorLines.points[0], terminatorLines.points[1]).curveLength();
        const terminatorWidth = (leaders[0].styleOverrides?.leader?.terminatorWidthFactor ?? 1) * textHeight;
        const terminatorHeight = (leaders[0].styleOverrides?.leader?.terminatorHeightFactor ?? 1) * textHeight;
        //  terminator length is calculated based on the terminator width and height factors.
        const expectedTerminatorLength = Math.sqrt(terminatorWidth * terminatorWidth + ((terminatorHeight / 2) * (terminatorHeight / 2)));
        expect(terminatorLength).to.be.closeTo(expectedTerminatorLength, 0.01);
      });

      it("should apply elbow length overrides", () => {
        const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        const leaderLines = builder.geometries[0] as LineString3d;
        // When elbow exists, the last two points in the leaderLines should form the elbow
        const elbowLine = LineSegment3d.create(leaderLines.points[leaderLines.points.length - 1], leaderLines.points[leaderLines.points.length - 2]);
        const elbowLength = elbowLine.curveLength();
        expect(elbowLength).to.be.closeTo((leaders[0].styleOverrides?.leader?.elbowLength ?? 1) * textHeight, 0.01);
      });

      it("should apply terminator shape overrides", () => {
        const terminatorHeight = (leaders[0].styleOverrides?.leader?.terminatorHeightFactor ?? 1) * textHeight;
        const terminatorWidth = (leaders[0].styleOverrides?.leader?.terminatorWidthFactor ?? 1) * textHeight;
        let firstLeaderLineLengthBeforeTruncation: number;
        terminatorShapes.forEach((shape: TerminatorShape) => {
          it(`Terminator shape: ${shape}`, () => {
            leaders[0].styleOverrides = { ...leaders[0].styleOverrides, leader: { terminatorShape: shape } };
            const result = appendLeadersToBuilder(builder, leaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
            expect(result).to.be.true;
            if (shape === "none") {
              expect(builder.geometries.length).to.equal(1); // Only leader line should be present with no terminators
            } else {
              let terminatorGeometry = builder.geometries[1];
              if (shape.includes("Filled")) {
                expect(builder.geometries.length).to.equal(3) // One entry for geometry query and another for geometryParams for fill
                terminatorGeometry = builder.geometries[2];
              }
              if (shape.includes("circle")) {
                expect((terminatorGeometry as Arc3d).circularRadius()).to.equal(terminatorHeight / 2)
              }

              if (shape === "slash") {
                expect(terminatorGeometry).to.be.instanceOf(LineSegment3d);
                expect(terminatorGeometry.curveLength()).to.equal(terminatorHeight);
              }

              if (shape === "closedArrow") {
                // The leaderLine is truncated to accommodate the closed and hollow shape of the terminator
                const leaderLine = builder.geometries[0] as LineString3d;
                const firstLeaderLine = LineSegment3d.create(leaderLine.points[0], leaderLine.points[1]);
                const firstLeaderLineLength = firstLeaderLine.curveLength();
                expect(firstLeaderLineLength).to.be.closeTo(firstLeaderLineLengthBeforeTruncation - terminatorWidth, 0.01);
              } else {
                // keep record of first leader line length before truncation for closedArrow test
                const leaderLine = builder.geometries[0] as LineString3d;
                const firstLeaderLineBeforeTruncation = LineSegment3d.create(leaderLine.points[0], leaderLine.points[1]);
                firstLeaderLineLengthBeforeTruncation = firstLeaderLineBeforeTruncation.curveLength();
              }
            }

          });

        });
      });

      it("should not append any geometry when both showLeaders and showTargetPoint are false", () => {
        const targetLeaders: TextAnnotationLeader[] = [{
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: { leader: { showLeaders: false, showTargetPoint: false } },
        }];
        const result = appendLeadersToBuilder(builder, targetLeaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        expect(builder.geometries.length).to.equal(0);
      });

      it("should not append leader line or terminator when showLeaders is false", () => {
        const targetLeaders: TextAnnotationLeader[] = [{
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: { leader: { showLeaders: false, showTargetPoint: true, targetPointShape: "cross" } },
        }];
        const result = appendLeadersToBuilder(builder, targetLeaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        // Only the target point graphic (a "cross" => two line segments) should be present.
        expect(builder.geometries.length).to.equal(2);
        for (const geometry of builder.geometries)
          expect(geometry).to.be.instanceOf(LineSegment3d);
      });

      it("should append the leader line but no terminator when showTerminators is false", () => {
        const targetLeaders: TextAnnotationLeader[] = [{
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: { leader: { showLeaders: true, showTerminators: false, showTargetPoint: false } },
        }];
        const result = appendLeadersToBuilder(builder, targetLeaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        // Only the leader line should be present, with no terminator geometry.
        expect(builder.geometries.length).to.equal(1);
        expect(builder.geometries[0]).to.be.instanceOf(LineString3d);
      });

      it("should append the target point graphic in addition to the leader line and terminator when showTargetPoint is true", () => {
        const targetLeaders: TextAnnotationLeader[] = [{
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: { leader: { showLeaders: true, showTerminators: true, showTargetPoint: true, targetPointShape: "cross" } },
        }];
        const result = appendLeadersToBuilder(builder, targetLeaders, layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        // leader line (1) + openArrow terminator (1) + cross target point (2) = 4 geometry entries.
        expect(builder.geometries.length).to.equal(4);
        expect(builder.geometries[0]).to.be.instanceOf(LineString3d); // leader line
        expect(builder.geometries[1]).to.be.instanceOf(LineString3d); // openArrow terminator
        expect(builder.geometries[2]).to.be.instanceOf(LineSegment3d); // cross segment
        expect(builder.geometries[3]).to.be.instanceOf(LineSegment3d); // cross segment
      });

      // Disable the leader line so that only the target point graphic is produced, making the assertions unambiguous.
      const makeTargetPointLeader = (shape: TargetPointShape): TextAnnotationLeader => ({
        startPoint: Point3d.create(10, 0, 0),
        attachment: { mode: "TextPoint", position: "TopLeft" },
        styleOverrides: { leader: { showLeaders: false, showTargetPoint: true, targetPointShape: shape } },
      });

      it("should draw a 'cross' target point as two crossed line segments", () => {
        const result = appendLeadersToBuilder(builder, [makeTargetPointLeader("cross")], layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        expect(builder.geometries.length).to.equal(2);
        for (const geometry of builder.geometries)
          expect(geometry).to.be.instanceOf(LineSegment3d);
      });

      it("should draw a 'plus' target point as two orthogonal line segments", () => {
        const result = appendLeadersToBuilder(builder, [makeTargetPointLeader("plus")], layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        expect(builder.geometries.length).to.equal(2);
        for (const geometry of builder.geometries)
          expect(geometry).to.be.instanceOf(LineSegment3d);
      });

      it("should draw a 'circle' target point with a radius of half the terminator height", () => {
        const terminatorHalfHeight = (TextStyleSettings.defaultProps.leader.terminatorHeightFactor ?? 1) * textHeight / 2;
        const result = appendLeadersToBuilder(builder, [makeTargetPointLeader("circle")], layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        expect(builder.geometries.length).to.equal(1);
        const circle = builder.geometries[0] as Arc3d;
        expect(circle).to.be.instanceOf(Arc3d);
        expect(circle.circularRadius()).to.be.closeTo(terminatorHalfHeight, 0.01);
      });

      it("should draw a 'square' target point as a closed line string with equal width and height", () => {
        const result = appendLeadersToBuilder(builder, [makeTargetPointLeader("square")], layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        expect(builder.geometries.length).to.equal(1);
        const square = builder.geometries[0] as LineString3d;
        expect(square).to.be.instanceOf(LineString3d);
        expect(square.points.length).to.equal(5); // closed loop
        const width = Math.abs(square.points[1].x - square.points[0].x);
        const height = Math.abs(square.points[2].y - square.points[1].y);
        expect(width).to.be.closeTo(height, 0.01);
      });

      it("should draw a 'rectangle' target point as a closed line string using configured width and height", () => {
        const terminatorWidth = (TextStyleSettings.defaultProps.leader.terminatorWidthFactor ?? 1) * textHeight;
        const terminatorHeight = (TextStyleSettings.defaultProps.leader.terminatorHeightFactor ?? 1) * textHeight;
        const result = appendLeadersToBuilder(builder, [makeTargetPointLeader("rectangle")], layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        expect(builder.geometries.length).to.equal(1);
        const rectangle = builder.geometries[0] as LineString3d;
        expect(rectangle).to.be.instanceOf(LineString3d);
        expect(rectangle.points.length).to.equal(5); // closed loop
        const width = Math.abs(rectangle.points[1].x - rectangle.points[0].x);
        const height = Math.abs(rectangle.points[2].y - rectangle.points[1].y);
        expect(width).to.be.closeTo(terminatorWidth, 0.01);
        expect(height).to.be.closeTo(terminatorHeight, 0.01);
      });

      it("should produce target point geometry for every predefined shape", () => {
        for (const shape of targetPointShapes) {
          const localBuilder = new MockBuilder();
          const result = appendLeadersToBuilder(localBuilder, [makeTargetPointLeader(shape)], layout, transform, new GeometryParams(Id64.invalid), textStyleResolver, scaleFactor);
          expect(result, `shape: ${shape}`).to.be.true;
          expect(localBuilder.geometries.length, `shape: ${shape}`).to.be.greaterThan(0);
        }
      });

      it("should not offset the leader start point when targetPointOffsetFactor is 0", () => {
        const leader: TextAnnotationLeader = {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: { leader: { showTargetPoint: true, targetPointOffsetFactor: 0 } },
        };
        const result = appendLeadersToBuilder(builder, [leader], layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        const leaderLine = builder.geometries[0] as LineString3d;
        expect(leaderLine.points[0].isAlmostEqual(leader.startPoint)).to.be.true;
      });

      it("should offset the leader start point away from the target point when targetPointOffsetFactor is non-zero", () => {
        const offsetFactor = 2;
        const leader: TextAnnotationLeader = {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: { leader: { showTargetPoint: true, targetPointOffsetFactor: offsetFactor } },
        };
        const result = appendLeadersToBuilder(builder, [leader], layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        const leaderLine = builder.geometries[0] as LineString3d;
        // The leader line should start away from the original start point by offsetFactor * textHeight.
        expect(leaderLine.points[0].isAlmostEqual(leader.startPoint)).to.be.false;
        const offsetDistance = leaderLine.points[0].distance(leader.startPoint);
        expect(offsetDistance).to.be.closeTo(offsetFactor * textHeight, 0.01);
      });

      it("should draw the target point graphic at the original start point regardless of the offset", () => {
        const offsetFactor = 2;
        const leader: TextAnnotationLeader = {
          startPoint: Point3d.create(10, 0, 0),
          attachment: { mode: "TextPoint", position: "TopLeft" },
          styleOverrides: { leader: { showLeaders: false, showTargetPoint: true, targetPointShape: "circle", targetPointOffsetFactor: offsetFactor } },
        };
        const result = appendLeadersToBuilder(builder, [leader], layout, transform, defaultParams, textStyleResolver, scaleFactor);
        expect(result).to.be.true;
        const circle = builder.geometries[0] as Arc3d;
        expect(circle).to.be.instanceOf(Arc3d);
        expect(circle.center.isAlmostEqual(leader.startPoint)).to.be.true;
      });

    });
  });

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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import type { TransformProps } from "@itwin/core-geometry";
import { Matrix3d, Point3d, Point4d, Transform } from "@itwin/core-geometry";
import { RenderSchedule } from "../RenderSchedule";
import { RgbColor } from "../RgbColor";

describe("RenderSchedule", () => {
  it("interpolates transforms", () => {
    const props: RenderSchedule.ScriptProps = [{
      modelId: "0x123",
      elementTimelines: [{
        batchId: 1,
        elementIds: [],
        transformTimeline: [
          {
            interpolation: 2,
            time: 1439798400,
            value: {
              orientation: [0, 0, 0, 1],
              pivot: [63533.371094, -16860.751953, 22829.71875],
              position: [-55672.671875, 25451.609375, -22869.257813],
              transform: [
                [1, 0, 0, 7860.699219],
                [0, 1, 0, 8590.857422],
                [0, 0, 1, -39.539063],
              ],
            },
          },
          {
            interpolation: 2,
            time: 1439798460,
            value: {
              orientation: [0, 0, 0, 1],
              pivot: [63533.371094, -16860.751953, 22829.71875],
              position: [-55652.878906, 25445.414063, -22869.257813],
              transform: [
                [1, 0, 0, 7880.492188],
                [0, 1, 0, 8584.662109],
                [0, 0, 1, -39.539063],
              ],
            },
          },
          {
            interpolation: 2,
            time: 1439890920,
            value: {
              orientation: [0, 0, 0, 1],
              pivot: [63533.371094, -16860.751953, 22829.71875],
              position: [-25152.789063, 15897.631836, -22869.257813],
              transform: [
                [1, 0, 0, 38380.582031],
                [0, 1, 0, -963.120117],
                [0, 0, 1, -39.539063],
              ],
            },
          },
          {
            interpolation: 2,
            time: 1439904180,
            value: {
              orientation: [
                -1.109122e-8,
                -3.543056e-8,
                -0.228533,
                0.973536,
              ],
              pivot: [63533.371094, -16860.751953, 22829.71875],
              position: [-20778.666016, 14528.351563, -22869.257813],
              transform: [
                [0.895545, -0.444971, 7.405529e-8, 43620.875],
                [0.444971, 0.895545, -5.401287e-9, 27699.283203],
                [-6.391644e-8, 3.778954e-8, 1, -39.543762],
              ],
            },
          },
          {
            interpolation: 2,
            time: 1439982060,
            value: {
              orientation: [
                -1.113305e-8,
                -3.556418e-8,
                -0.229395,
                0.973333,
              ],
              pivot: [63533.371094, -16860.751953, 22829.71875],
              position: [5798.800781, 18796.800781, -22869.259766],
              transform: [
                [0.894756, -0.446556, 7.433935e-8, 70174.921875],
                [0.446556, 0.894756, -5.35584e-9, 32081.748047],
                [-6.412388e-8, 3.798884e-8, 1, -39.545731],
              ],
            },
          },
          {
            interpolation: 2,
            time: 1439996640,
            value: {
              orientation: [0.005562, 0.077206, 0.104044, 0.991556],
              pivot: [63533.371094, -16860.751953, 22829.71875],
              position: [10774.503906, 19597.402344, -22869.259766],
              transform: [
                [0.966428, 0.20719, -0.15195, 65212.59375],
                [-0.205472, 0.978288, 0.027096, -9333.005859],
                [0.154265, 0.005035, 0.988017, 9402.956055],
              ],
            },
          },
          {
            interpolation: 1,
            time: 1440172740,
            value: {
              orientation: [0.005575, 0.077382, 0.104837, 0.991459],
              pivot: [63533.371094, -16860.751953, 22829.71875],
              position: [63098.109375, -10204.736328, -13983.59082],
              transform: [
                [0.966043, 0.208746, -0.152273, 117478.09375],
                [-0.207021, 0.977956, 0.02728, -39223.738281],
                [0.15461, 0.00517, 0.987962, 18307.048828],
              ],
            },
          },
        ],
      }],
    }];

    const script = RenderSchedule.Script.fromJSON(props)!;
    expect(script).not.to.be.undefined;

    function expectTransform(timepoint: number, expected: TransformProps): void {
      const actual = script.getTransform("0x123", 1, timepoint)!;
      expect(actual).not.to.be.undefined;
      expect(actual.isAlmostEqual(Transform.fromJSON(expected))).to.be.true;
    }

    expectTransform(script.duration.low, [[1,0,0,7860.699219],[0,1,0,8590.857422],[0,0,1,-39.539063]]);

    expectTransform(script.duration.high, [
      [0.966043,0.208746,-0.152273,117478.09375],
      [-0.207021,0.977956,0.02728,-39223.738281],
      [0.15461,0.00517,0.987962,18307.048828],
    ]);

    expectTransform(script.duration.fractionToPoint(0.5), [
      [0.9542084100696944,-0.29673855635648877,-0.037848901222266286,71759.88767870933],
      [0.29684190212797457,0.9549219611634173,-0.002988850758880856,21679.967974600604],
      [0.03702965424240229,-0.008383153301704048,0.9992790038059481,2437.9638765390373],
    ]);
  });

  it("interpolates visibility", () => {
    const props: RenderSchedule.TimelineProps = {
      visibilityTimeline: [{
        interpolation: 2, time: 1254330000, value: undefined,
      }, {
        interpolation: 2, time: 1369123200, value: 70,
      }, {
        interpolation: 2, time: 1369123260, value: 69,
      }, {
        interpolation: 1, time: 1370710740, value: 30,
      }],
    };

    const timeline = new RenderSchedule.Timeline(props);
    const vis = timeline.visibility!;
    let i = 0;
    for (const entry of vis)
      expect(timeline.getVisibility(entry.time)).to.equal(vis.getValue(i++));

    expect(timeline.getVisibility(timeline.duration.low)).to.equal(100);
    expect(timeline.getVisibility(timeline.duration.high)).to.equal(30);
    expect(timeline.getVisibility(timeline.duration.low * 0.5)).to.equal(100);
    expect(timeline.getVisibility(timeline.duration.high * 2)).to.equal(30);

    for (let j = 0; j < 3; j++) {
      const a = props.visibilityTimeline![j];
      const b = props.visibilityTimeline![j + 1];
      const time = a.time + (b.time - a.time) / 2;
      const value = (a.value ?? 100) + ((b.value ?? 100) - (a.value ?? 100)) / 2;
      expect(timeline.getVisibility(time)).to.equal(value);
    }
  });

  describe("ScriptBuilder", () => {
    it("sorts and compresses element Ids", () => {
      function expectIds(input: string | string[], expected: string): void {
        const script = new RenderSchedule.ScriptBuilder();
        const model = script.addModelTimeline("0x123");
        const element = model.addElementTimeline(input);
        expect(element.elementIds).to.equal(expected);
      }

      expectIds("+1+4", "+1+4");
      expectIds(["0x1", "0x5"], "+1+4");
      expectIds(["0x5", "0x1"], "+1+4");
    });

    it ("assigns unique consecutive batch Ids", () => {
      const script = new RenderSchedule.ScriptBuilder();
      const modelA = script.addModelTimeline("0xa");
      const modelB = script.addModelTimeline("0xb");

      const elemA1 = modelA.addElementTimeline(["0xa1"]);
      const elemB1 = modelB.addElementTimeline(["0xb1"]);
      const elemB2 = modelB.addElementTimeline(["0xb2"]);
      const elemA2 = modelA.addElementTimeline(["0xa2"]);

      expect(elemA1.batchId).to.equal(1);
      expect(elemB1.batchId).to.equal(2);
      expect(elemB2.batchId).to.equal(3);
      expect(elemA2.batchId).to.equal(4);
    });

    it("produces expected JSON", () => {
      const linear = RenderSchedule.Interpolation.Linear;
      const expected: RenderSchedule.ScriptProps = [{
        modelId: "0x1",
        visibilityTimeline: [{
          time: 100,
          interpolation: linear,
          value: undefined,
        }, {
          time: 200,
          interpolation: linear,
          value: 50,
        }],
        elementTimelines: [{
          elementIds: "+1+4",
          batchId: 1,
          colorTimeline: [{
            time: 300,
            interpolation: RenderSchedule.Interpolation.Step,
            value: { red: 1, green: 2, blue: 3 },
          }],
        }],
      }, {
        modelId:"0x2",
        realityModelUrl: "https://google.com",
        elementTimelines: [{
          elementIds: "+ABC",
          batchId: 2,
          transformTimeline: [{
            time: 400,
            interpolation: linear,
            value: {
              transform: [ [ 1, 0, 0, 4 ], [ 0, 1, 0, 5 ], [ 0, 0, 1, 6] ],
            },
          }, {
            time: 500,
            interpolation: linear,
            value: {
              transform: [ [ 1, 0, 0, 4 ], [ 0, 1, 0, 5 ], [ 0, 0, 1, 6] ],
              pivot: [ 1, 2, 3 ],
              orientation: [ 4, 5, 6, 7 ],
              position: [ 8, 9, 0 ],
            },
          }],
        }, {
          elementIds: "+DEF",
          batchId: 3,
          cuttingPlaneTimeline: [{
            time: 600,
            interpolation: linear,
            value: {
              position: [ 1, 2, 3 ],
              direction: [ 0, 0, -1 ],
              visible: true,
            },
          }],
        }],
      }];

      const script = new RenderSchedule.ScriptBuilder();
      const model1 = script.addModelTimeline("0x1");
      model1.addVisibility(100, undefined);
      model1.addVisibility(200, 50);

      const elem1 = model1.addElementTimeline("+1+4");
      elem1.addColor(300, new RgbColor(1, 2, 3), RenderSchedule.Interpolation.Step);

      const model2 = script.addModelTimeline("0x2");
      model2.realityModelUrl = "https://google.com";

      const elem2 = model2.addElementTimeline(["0xabc"]);
      elem2.addTransform(400, Transform.createRefs(new Point3d(4, 5, 6), Matrix3d.createIdentity()));
      elem2.addTransform(500, Transform.createRefs(new Point3d(4, 5, 6), Matrix3d.createIdentity()), { pivot: new Point3d(1, 2, 3), position: new Point3d(8, 9, 0), orientation: Point4d.create(4, 5, 6, 7) });

      const elem3 = model2.addElementTimeline(["0xdef"]);
      elem3.addCuttingPlane(600, { position: new Point3d(1, 2, 3), direction: new Point3d(0, 0, -1), visible: true });

      expect(script.finish()).to.deep.equal(expected);
    });
  });
});

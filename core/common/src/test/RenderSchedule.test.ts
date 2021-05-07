/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Transform, TransformProps } from "@bentley/geometry-core";
import { RenderSchedule } from "../RenderSchedule";

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
});

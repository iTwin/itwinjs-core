/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { CompressedId64Set } from "@itwin/core-bentley";
import { Matrix3d, Point3d, Point4d, Transform, TransformProps } from "@itwin/core-geometry";
import { RenderSchedule as RS } from "../RenderSchedule";
import { RgbColor } from "../RgbColor";

describe("RenderSchedule", () => {
  it("interpolates transforms", () => {
    const props: RS.ScriptProps = [{
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

    const script = RS.Script.fromJSON(props)!;
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
    const props: RS.TimelineProps = {
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

    const timeline = new RS.Timeline(props);
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
        const script = new RS.ScriptBuilder();
        const model = script.addModelTimeline("0x123");
        const element = model.addElementTimeline(input);
        expect(element.elementIds).to.equal(expected);
      }

      expectIds("+1+4", "+1+4");
      expectIds(["0x1", "0x5"], "+1+4");
      expectIds(["0x5", "0x1"], "+1+4");
    });

    it ("assigns unique consecutive batch Ids", () => {
      const script = new RS.ScriptBuilder();
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
      const linear = RS.Interpolation.Linear;
      const expected: RS.ScriptProps = [{
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
            interpolation: RS.Interpolation.Step,
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

      const script = new RS.ScriptBuilder();
      const model1 = script.addModelTimeline("0x1");
      model1.addVisibility(100, undefined);
      model1.addVisibility(200, 50);

      const elem1 = model1.addElementTimeline("+1+4");
      elem1.addColor(300, new RgbColor(1, 2, 3), RS.Interpolation.Step);

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

  interface HasEquals<T> {
    equals(other: T): boolean;
  }

  function expectEquality<T extends HasEquals<T>>(a: T, b: T, expected: boolean): void {
    expect(a.equals(b)).to.equal(expected);
  }

  function expectEqual<T extends HasEquals<T>>(a: T, b: T): void {
    expectEquality(a, b, true);
  }

  function expectUnequal<T extends HasEquals<T>>(a: T, b: T): void {
    expectEquality(a, b, false);
  }

  describe("VisibilityEntry", () => {
    it("compares for equality", () => {
      expectEqual(new RS.VisibilityEntry({ time: 1 }), new RS.VisibilityEntry({ time: 1 }));
      expectUnequal(new RS.VisibilityEntry({ time: 1 }), new RS.VisibilityEntry({ time: 2 }));
      expectEqual(new RS.VisibilityEntry({ time: 1, interpolation: 1 }), new RS.VisibilityEntry({ time: 1, interpolation: 1 }));
      expectUnequal(new RS.VisibilityEntry({ time: 1, interpolation: 1 }), new RS.VisibilityEntry({ time: 1, interpolation: 2 }));

      expectEqual(new RS.VisibilityEntry({ time: 1, value: 2 }), new RS.VisibilityEntry({ time: 1, value: 2 }));
      expectUnequal(new RS.VisibilityEntry({ time: 1, value: 2 }), new RS.VisibilityEntry({ time: 1, value: 3 }));
    });
  });

  describe("ColorEntry", () => {
    it("compares for equality", () => {
      expectEqual(new RS.ColorEntry({ time: 1 }), new RS.ColorEntry({ time: 1 }));
      expectUnequal(new RS.ColorEntry({ time: 1 }), new RS.ColorEntry({ time: 2 }));
      expectEqual(new RS.ColorEntry({ time: 1, interpolation: 1 }), new RS.ColorEntry({ time: 1, interpolation: 1 }));
      expectUnequal(new RS.ColorEntry({ time: 1, interpolation: 1 }), new RS.ColorEntry({ time: 1, interpolation: 2 }));

      expectEqual(new RS.ColorEntry({ time: 1, value: { red: 1, green: 2, blue: 3 } }), new RS.ColorEntry({time: 1, value: { red: 1, green: 2, blue: 3 } }));
      expectUnequal(new RS.ColorEntry({ time: 1, value: { red: 1, green: 2, blue: 3 } }), new RS.ColorEntry({time: 1, value: { red: 3, green: 2, blue: 1 } }));
    });
  });

  function makeTransform(aa: number, bb: number, cc: number, dd: number) {
    return {
      transform: [
        [aa, 0, 0, 0],
        [0, bb, 0, 0],
        [0, 0, cc, 0],
        [0, 0, 0, dd],
      ],
    };
  }

  function makeTransformComponents(pos: number, rot: number, pivot: number) {
    return {
      position: [pos, 0, 0],
      orientation: [0, rot, 0, 0],
      pivot: [0, 0, pivot],
    };
  }

  describe("TransformEntry", () => {
    it("compares for equality", () => {
      expectEqual(new RS.TransformEntry({ time: 1 }), new RS.TransformEntry({ time: 1 }));
      expectUnequal(new RS.TransformEntry({ time: 1 }), new RS.TransformEntry({ time: 2 }));
      expectEqual(new RS.TransformEntry({ time: 1, interpolation: 1 }), new RS.TransformEntry({ time: 1, interpolation: 1 }));
      expectUnequal(new RS.TransformEntry({ time: 1, interpolation: 1 }), new RS.TransformEntry({ time: 1, interpolation: 2 }));

      const tf = makeTransform;
      expectEqual(new RS.TransformEntry({ time: 1, value: tf(1, 2, 3, 4) }), new RS.TransformEntry({ time: 1, value: tf(1, 2, 3, 4) }));
      expectUnequal(new RS.TransformEntry({ time: 1, value: tf(1, 2, 3, 4) }), new RS.TransformEntry({ time: 1, value: tf(5, 6, 7, 8) }));

      const cmp = makeTransformComponents;
      expectEqual(new RS.TransformEntry({ time: 1, value: cmp(1, 2, 3) }), new RS.TransformEntry({ time: 1, value: cmp(1, 2, 3) }));
      expectUnequal(new RS.TransformEntry({ time: 1, value: cmp(1, 2, 3) }), new RS.TransformEntry({ time: 1, value: cmp(3, 2, 1) }));

      expectUnequal(new RS.TransformEntry({time: 1, value: tf(1, 2, 3, 4) }), new RS.TransformEntry({ time: 1, value: cmp(1, 2, 3) }));
    });
  });

  function makeCuttingPlane(pos: number, dir: number, vis?: "vis" | "hid") {
    return {
      position: [pos, 0, 0],
      direction: [0, dir, 0],
      visible: vis === "vis",
      hidden: vis === "hid",
    };
  }

  describe("CuttingPlaneEntry", () => {
    it("compares for equality", () => {
      expectEqual(new RS.CuttingPlaneEntry({ time: 1 }), new RS.CuttingPlaneEntry({ time: 1 }));
      expectUnequal(new RS.CuttingPlaneEntry({ time: 1 }), new RS.CuttingPlaneEntry({ time: 2 }));
      expectEqual(new RS.CuttingPlaneEntry({ time: 1, interpolation: 1 }), new RS.CuttingPlaneEntry({ time: 1, interpolation: 1 }));
      expectUnequal(new RS.CuttingPlaneEntry({ time: 1, interpolation: 1 }), new RS.CuttingPlaneEntry({ time: 1, interpolation: 2 }));

      const cp = makeCuttingPlane;
      expectEqual(new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2, "vis") }), new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2, "vis") }));
      expectEqual(new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2) }), new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2) }));
      expectEqual(new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2, "hid") }), new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2, "hid") }));

      expectUnequal(new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2, "vis") }), new RS.CuttingPlaneEntry({ time: 1, value: cp(3, 2, "vis") }));
      expectUnequal(new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2, "hid") }), new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 3, "hid") }));
      expectUnequal(new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2, "vis") }), new RS.CuttingPlaneEntry({ time: 1, value: cp(1, 2, "hid") }));
    });
  });

  describe("ElementTimeline", () => {
    it("compares for equality", () => {
      const elementIds = ["0x1", "0x5", "0xabc"];
      const compressedIds = CompressedId64Set.compressArray(elementIds);

      expectEqual(RS.ElementTimeline.fromJSON({ batchId: 4, elementIds }), RS.ElementTimeline.fromJSON({ batchId: 4, elementIds }));
      expectEqual(RS.ElementTimeline.fromJSON({ batchId: 4, elementIds: compressedIds }), RS.ElementTimeline.fromJSON({ batchId: 4, elementIds: compressedIds }));
      expectEqual(RS.ElementTimeline.fromJSON({ batchId: 4, elementIds }), RS.ElementTimeline.fromJSON({ batchId: 4, elementIds: compressedIds }));

      expectUnequal(RS.ElementTimeline.fromJSON({ batchId: 4, elementIds }), RS.ElementTimeline.fromJSON({ batchId: 5, elementIds }));

      expectUnequal(RS.ElementTimeline.fromJSON({ batchId: 4, elementIds }), RS.ElementTimeline.fromJSON({ batchId: 4, elementIds: ["0xabc"] }));
      expectUnequal(RS.ElementTimeline.fromJSON({ batchId: 4, elementIds }), RS.ElementTimeline.fromJSON({ batchId: 4, elementIds: ["0x1", "0x5"] }));
      expectUnequal(RS.ElementTimeline.fromJSON({ batchId: 4, elementIds }), RS.ElementTimeline.fromJSON({ batchId: 4, elementIds: ["0x1", "0x5", "0xdef"] }));

      const v1 = { time: 3, interpolation: 1, value: 1 };
      const v2 = { time: 4, interpolation: 2, value: 2 };
      const c1 = { time: 3, interpolation: 2, value: { red: 0, green: 1, blue: 2 } };
      const c2 = { time: 4, interpolation: 2, value: { red: 255, green: 254, blue: 253 } };
      const t1 = { time: 3, value: makeTransform(-1, 0, 1, 2) };
      const t2 = { time: 4, value: makeTransformComponents(8, 9, -10) };
      const p1 = { time: 3, interpolation: 2, value: makeCuttingPlane(1, 2) };
      const p2 = { time: 4, interpolation: 1, value: makeCuttingPlane(-1, -2, "hid") };

      const visibilityTimeline = [v1, v2];
      const colorTimeline = [c1, c2];
      const transformTimeline = [t1, t2];
      const cuttingPlaneTimeline = [p1, p2];

      const timelineProps = { visibilityTimeline, colorTimeline, transformTimeline, cuttingPlaneTimeline, batchId: 1, elementIds };
      const timeline = RS.ElementTimeline.fromJSON(timelineProps);
      expectEqual(timeline, RS.ElementTimeline.fromJSON(timelineProps));

      const stringifiedProps = JSON.stringify(timelineProps);
      const keys = ["visibilityTimeline", "colorTimeline", "transformTimeline", "cuttingPlaneTimeline"] as const;
      for (const key of keys) {
        let props = { ...timelineProps };
        delete props[key];
        expectUnequal(timeline, RS.ElementTimeline.fromJSON(props));
        expectEqual(RS.ElementTimeline.fromJSON(props), RS.ElementTimeline.fromJSON(props));

        props = JSON.parse(stringifiedProps);
        props[key].pop();
        expectUnequal(timeline, RS.ElementTimeline.fromJSON(props));
        expectEqual(RS.ElementTimeline.fromJSON(props), RS.ElementTimeline.fromJSON(props));

        props = JSON.parse(stringifiedProps);
        props[key].push(props[key][1] as any);
        expectUnequal(timeline, RS.ElementTimeline.fromJSON(props));
        expectEqual(RS.ElementTimeline.fromJSON(props), RS.ElementTimeline.fromJSON(props));
      }
    });

    it("considers the same element Ids equal only if in the same order", () => {
      const sortedIds = ["0x1", "0x5", "0xabc"];
      const unsortedIds = ["0x5", "0xabc", "0x1"];
      const compressedIds = CompressedId64Set.compressArray(sortedIds);

      const sorted = RS.ElementTimeline.fromJSON({ batchId: 0, elementIds: sortedIds });
      const unsorted = RS.ElementTimeline.fromJSON({ batchId: 0, elementIds: unsortedIds });
      const compressed = RS.ElementTimeline.fromJSON({ batchId: 0, elementIds: compressedIds });

      expectEqual(sorted, compressed);
      expectUnequal(sorted, unsorted);
      expectUnequal(compressed, unsorted);
    });
  });

  describe("ModelTimeline", () => {
    it("compares for equality", () => {
      const elementTimelines: RS.ElementTimelineProps[] = [];
      expectEqual(RS.ModelTimeline.fromJSON({ modelId: "0x1", realityModelUrl: "blah", elementTimelines }), RS.ModelTimeline.fromJSON({ modelId: "0x1", realityModelUrl: "blah", elementTimelines }));
      expectEqual(RS.ModelTimeline.fromJSON({ modelId: "0x2", elementTimelines }), RS.ModelTimeline.fromJSON({ modelId: "0x2", elementTimelines }));

      expectUnequal(RS.ModelTimeline.fromJSON({ modelId: "0x1", realityModelUrl: "blah", elementTimelines }), RS.ModelTimeline.fromJSON({ modelId: "0x1", elementTimelines }));
      expectUnequal(RS.ModelTimeline.fromJSON({ modelId: "0x1", realityModelUrl: "blah", elementTimelines }), RS.ModelTimeline.fromJSON({ modelId: "0x2", realityModelUrl: "blah", elementTimelines }));
      expectUnequal(RS.ModelTimeline.fromJSON({ modelId: "0x1", elementTimelines }), RS.ModelTimeline.fromJSON({ modelId: "0x1", elementTimelines: [{ batchId: 0, elementIds: ["0x2"] }] }));
    });
  });

  describe("Script", () => {
    it("considers the same model Ids equal only if in the same order", () => {
      const elementTimelines: RS.ElementTimelineProps[] = [];
      const m1 = { modelId: "0x1", elementTimelines };
      const m2 = { modelId: "0x2", elementTimelines };
      const m3 = { modelId: "0x3", elementTimelines };
      expectEqual(RS.Script.fromJSON([m1, m2, m3])!, RS.Script.fromJSON([m1, m2, m3])!);
      expectUnequal(RS.Script.fromJSON([m1, m2, m3])!, RS.Script.fromJSON([m3, m2, m1])!);
    });

    it("weakly caches previous comparisons", () => {
      const elementTimelines: RS.ElementTimelineProps[] = [];
      const s1 = RS.Script.fromJSON([{modelId: "0x1", elementTimelines}])!;
      const s2 = RS.Script.fromJSON([{modelId: "0x2", elementTimelines}])!;

      function spy(timeline: any): void {
        timeline.compared = false;
        const impl = timeline.compareTo;
        timeline.compareTo = (other: RS.ModelTimeline) => {
          timeline.compared = true;
          return impl.call(timeline, other);
        };
      }

      const m1 = s1.modelTimelines[0] as any;
      const m2 = s2.modelTimelines[0] as any;
      spy(m1);
      spy(m2);

      // Nothing yet in cache.
      expect(s1.compareTo(s2)).to.equal(-1);
      expect(m1.compared).to.be.true;
      expect(m2.compared).to.be.false;

      // Reset
      m1.compared = false;

      // *Both* scripts cache the results of the comparison (the result, if non-zero, is inverted for the argument to compareTo).
      expect(s2.compareTo(s1)).to.equal(1);
      expect(m1.compared).to.be.false;
      expect(m2.compared).to.be.false;

      // The forward comparison is still cached.
      expect(s1.compareTo(s2)).to.equal(-1);
      expect(m1.compared).to.be.false;
      expect(m2.compared).to.be.false;
    });
  });
});

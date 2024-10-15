/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { Feature, FeatureTable, GeometryClass, LinePixels } from "@itwin/core-common";
import { Point3d, Transform, XYZProps } from "@itwin/core-geometry";
import { expect } from "chai";
import { InstancedGraphicPropsBuilder } from "../../common/internal/render/InstancedGraphicPropsBuilder";
import { OvrFlags } from "../../common/internal/render/OvrFlags";
import { InstancedGraphicProps } from "../../common/render/InstancedGraphicParams";
import { Instance, InstanceSymbology } from "../../common/render/RenderInstancesParams";

function build(instances: Instance[], haveFeatures = false): InstancedGraphicProps {
  const builder = new InstancedGraphicPropsBuilder();
  for (const instance of instances) {
    builder.add(instance);
  }

  const featureTable = haveFeatures ? new FeatureTable(1000) : undefined;
  const props = builder.finish(featureTable);
  expect(props).not.to.be.undefined;
  return props;
}

function makeInstance(tf: Transform | XYZProps = [1, 2, 3], feature?: Id64String | Feature, symbology?: InstanceSymbology): Instance {
  const transform = tf instanceof Transform ? tf : Transform.createTranslation(Point3d.fromJSON(tf));
  return { transform, feature, symbology };
}

describe("InstancedGraphicPropsBuilder", () => {
  it("only populates feature indices if features are provided", () => {
    const instances = [makeInstance(), makeInstance(), makeInstance(), makeInstance()];
    expect(build(instances).featureIds).to.be.undefined;

    const props = build(instances, true);
    expect(props.featureIds!.byteLength).to.equal(3 * 4);
  });

  it("only populates symbology overrides if symbology is overridden", () => {
    expect(build([makeInstance(), makeInstance(undefined, "0x123"), makeInstance()]).symbologyOverrides).to.be.undefined;

    const props = build([makeInstance(), makeInstance(undefined, "0x123"), makeInstance(undefined, undefined, { weight: 12 })]);
    expect(props.symbologyOverrides!.byteLength).to.equal(3 * 8);
  });

  it("computes transforms relative to center", () => {
    const instances = [makeInstance([0, 0, 0])];
    function expectCenter(expected: [number, number, number]): void {
      const props = build(instances);
      expect(props.transformCenter.x).to.equal(expected[0]);
      expect(props.transformCenter.y).to.equal(expected[1]);
      expect(props.transformCenter.z).to.equal(expected[2]);

      for (let i = 0; i < instances.length; i++) {
        const o = instances[i].transform.origin;
        const j = i * 12;
        expect(props.transforms[j + 3]).to.equal(o.x - props.transformCenter.x);
        expect(props.transforms[j + 7]).to.equal(o.y - props.transformCenter.y);
        expect(props.transforms[j + 11]).to.equal(o.z - props.transformCenter.z);
      }
    }

    expectCenter([0, 0, 0]);
    instances.push(makeInstance([10, -20, 0]));
    expectCenter([5, -10, 0]);
    instances.push(makeInstance([0, 40, 100]));
    expectCenter([5, 10, 50]);
  });

  it("computes symbology overrides", () => {
    const transform = Transform.createIdentity();
    const instances: Instance[] = [
      { transform, symbology: { color: { r: 63, g: 127, b: 191 } } },
      { transform, symbology: { weight: 25 } },
      { transform, symbology: { linePixels: LinePixels.Code3 } },
      { transform },
      { transform, symbology: { color: { r: 123, g: 255, b: 0 }, weight: 15, linePixels: LinePixels.Code7 } },

      { transform, symbology: { linePixels: LinePixels.Code0 } },
      { transform, symbology: { linePixels: -1 as LinePixels } },
      { transform, symbology: { linePixels: 20 as LinePixels } },
      { transform, symbology: { linePixels: 2.7 as LinePixels } },

      { transform, symbology: { weight: 0 } },
      { transform, symbology: { weight: 31 } },
      { transform, symbology: { weight: 32 } },
      { transform, symbology: { weight: -1 } },
      { transform, symbology: { weight: 12.7 } },

      { transform, symbology: { color: { r: -1, g: 256, b: 127.7 } } },
      { transform, symbology: { color: { r: 0, g: 255, b: 127.2 } } },
    ];

    const props = build(instances);
    const symbs = props.symbologyOverrides!;
    expect(symbs).not.to.be.undefined;
    expect(symbs.byteLength).to.equal(8 * instances.length);

    function expectOvrs(instanceIdx: number, expected: { rgb?: [number, number, number], weight?: number, lineCode?: number }): void {
      const i = instanceIdx * 8;
      const rgb = expected.rgb ?? [0, 0, 0];
      const weight = expected.weight ?? 0;
      const lineCode = expected.lineCode ?? 0;

      const flags = (
        undefined !== expected.rgb ? OvrFlags.Rgb : 0
      ) | (
        undefined !== expected.weight ? OvrFlags.Weight : 0
      ) | (
        undefined !== expected.lineCode ? OvrFlags.LineCode : 0
      );

      expect(symbs[i + 0]).to.equal(flags);
      expect(symbs[i + 1]).to.equal(weight);
      expect(symbs[i + 2]).to.equal(lineCode);
      expect(symbs[i + 3]).to.equal(0);

      expect(symbs[i + 4]).to.equal(rgb[0]);
      expect(symbs[i + 5]).to.equal(rgb[1]);
      expect(symbs[i + 6]).to.equal(rgb[2]);
      expect(symbs[i + 7]).to.equal(0);
    }

    expectOvrs(0, { rgb: [63, 127, 191] });
    expectOvrs(1, { weight: 25 });
    expectOvrs(2, { lineCode: 3 });
    expectOvrs(3, {});
    expectOvrs(4, { rgb: [123, 255, 0], weight: 15, lineCode: 7 });

    // Any value that doesn't map to a LinePixels enum member is treated as line code zero (solid).
    expectOvrs(5, { lineCode: 0 });
    expectOvrs(6, { lineCode: 0 });
    expectOvrs(7, { lineCode: 0 });
    expectOvrs(8, { lineCode: 0 });

    // Weight gets clamped to [1,31] and floored.
    expectOvrs(9, { weight: 1 });
    expectOvrs(10, { weight: 31 });
    expectOvrs(11, { weight: 31 });
    expectOvrs(12, { weight: 1 });
    expectOvrs(13, { weight: 12 });

    // r, g, and b get clamped to [0,255] and floored.
    expectOvrs(14, { rgb: [0, 255, 127] });
    expectOvrs(15, { rgb: [0, 255, 127] });
  });

  it("allocates features and feature indices", () => {
    type FeatureProps = [elem: string, subcat: string, cls: GeometryClass];
    function expectFeatures(instances: Instance[], expectedFeatures: FeatureProps[], expectedIndices: number[]): void {
      const builder = new InstancedGraphicPropsBuilder();
      for (const instance of instances) {
        builder.add(instance);
      }

      const ft = new FeatureTable(9999);
      const props = builder.finish(ft);

      expect(ft.length).to.equal(expectedFeatures.length);
      const actualFeatures = ft.getArray().map((x) => [x.value.elementId, x.value.subCategoryId, x.value.geometryClass]);
      expect(actualFeatures).to.deep.equal(expectedFeatures);

      const ftIds = props.featureIds!;
      expect(ftIds.byteLength).to.equal(3 * instances.length);
      const actualIndices = [];
      for (let i = 0; i < ftIds.byteLength; i += 3) {
        actualIndices.push(ftIds[i] | (ftIds[i + 1] << 8) | (ftIds[i + 2] << 16));
      }

      expect(actualIndices).to.deep.equal(expectedIndices);
    }

    expectFeatures([
      makeInstance(undefined, "0x123"),
      makeInstance(),
      makeInstance(undefined, "0x123"),
      makeInstance(undefined, new Feature("0x123", "0x456")),
      makeInstance(undefined, new Feature("0x123", undefined, GeometryClass.Pattern)),
      makeInstance(undefined, new Feature("0x789", "0xabc", GeometryClass.Construction)),
      makeInstance(),
      makeInstance(undefined, "0x123"),
      makeInstance(undefined, new Feature("0x789", "0xabc", GeometryClass.Construction)),
    ], [
      // Ordering of Feature in FeatureTable is sorted first by GeometryClass, then element Id, and finally subcategory Id.
      ["0", "0", GeometryClass.Primary],
      ["0x123", "0", GeometryClass.Primary],
      ["0x123", "0x456", GeometryClass.Primary],
      ["0x789", "0xabc", GeometryClass.Construction],
      ["0x123", "0", GeometryClass.Pattern],
    ], [
      // But feature Ids are assigned at insertion time.
      0,
      1,
      0,
      2,
      3,
      4,
      1,
      0,
      4,
    ]);
  });
});

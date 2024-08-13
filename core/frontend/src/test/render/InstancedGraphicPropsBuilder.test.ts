/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef, Feature, FeatureTable } from "@itwin/core-common";
import { InstancedGraphicPropsBuilder } from "../../common/internal/render/InstancedGraphicPropsBuilder";
import { InstancedGraphicProps } from "../../common/render/InstancedGraphicParams";
import { Instance, InstanceSymbology } from "../../common/render/RenderInstancesParams";
import { expect } from "chai";
import { Point3d, Transform, XYZProps } from "@itwin/core-geometry";
import { Id64String } from "@itwin/core-bentley";

function build(instances: Instance[], haveFeatures = false): InstancedGraphicProps {
  const builder = new InstancedGraphicPropsBuilder();
  for (const instance of instances) {
    builder.add(instance);
  }

  const featureTable = haveFeatures ? new FeatureTable(1000) : undefined;
  const props = builder.finish(featureTable);
  expect(props).not.to.be.undefined;
  return props!;
}

function makeInstance(tf: Transform | XYZProps = [1, 2, 3], feature?: Id64String | Feature, symbology?: InstanceSymbology): Instance {
  const transform = tf instanceof Transform ? tf : Transform.createTranslation(Point3d.fromJSON(tf));
  return { transform, feature, symbology };
}

describe.only("InstancedGraphicPropsBuilder", () => {
  it("only populates feature indices if features are provided", () => {
    const instances = [makeInstance(), makeInstance(), makeInstance(), makeInstance()];
    expect(build(instances).featureIds).to.be.undefined;

    const props = build(instances, true);
    expect(props.featureIds!.byteLength).to.equal(3 * 4);
  });

  it ("only populates symbology overrides if symbology is overridden", () => {
    expect(build([makeInstance(), makeInstance(undefined, "0x123"), makeInstance()]).symbologyOverrides).to.be.undefined;

    const props = build([makeInstance(), makeInstance(undefined, "0x123"), makeInstance(undefined, undefined, { transparency: 0.5 })]);
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
    
  });

  it("allocates features and feature indices", () => {
    
  });

  it("defaults to feature index zero for instances with no feature", () => {
    
  });
});



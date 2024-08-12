/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Feature, FeatureTable } from "@itwin/core-common";
import { InstancedGraphicPropsBuilder } from "../../common/internal/render/InstancedGraphicPropsBuilder";
import { InstancedGraphicProps } from "../../common/render/InstancedGraphicParams";
import { Instance, InstanceSymbology } from "../../common/render/RenderInstancesParams";
import { expect } from "chai";
import { Point3d, Transform, XYZProps } from "@itwin/core-geometry";
import { Id64String } from "@itwin/core-bentley";

function build(instances: Instance[]): InstancedGraphicProps {
  const builder = new InstancedGraphicPropsBuilder();
  for (const instance of instances) {
    builder.add(instance);
  }

  const featureTable = new FeatureTable(1000);
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
    expect(build([
      makeInstance(),
      makeInstance([4, 5, 6]),
      makeInstance([7, 8, 9], undefined, { weight: 5 }),
    ]).featureIds).to.be.undefined;

    const props = build([
      makeInstance(),
      makeInstance([4, 5, 6], "0x456"),
      makeInstance([7, 8, 9], undefined, { weight: 5 }),
      makeInstance([-1, -1, -1], undefined, { transparency: 0.5 }),
    ]);
    expect(props.featureIds).not.to.be.undefined;
    expect(props.featureIds!.byteLength).to.equal(3 * 4);
  });

  it ("only populates symbology overrides if symbology is overridden", () => {
    
  });

  it("computes transforms relative to center", () => {
    
  });

  it("computes symbology overrides", () => {
    
  });

  it("allocates features and feature indices", () => {
    
  });

  it("defaults to feature index zero for instances with no feature", () => {
    
  });
});



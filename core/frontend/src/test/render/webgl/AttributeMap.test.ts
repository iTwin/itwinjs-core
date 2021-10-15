/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { AttributeMap } from "../../../render/webgl/AttributeMap";
import { TechniqueId } from "../../../render/webgl/TechniqueId";

describe("AttributeMap tests", () => {
  it("should find default AttributeMap with and without instancing", () => {
    let attrMap = AttributeMap.findAttributeMap(undefined, false);
    const sizeA = attrMap.size;
    expect(sizeA).to.be.greaterThan(0); // map should have at least one entry

    attrMap = AttributeMap.findAttributeMap(undefined, true);
    expect(attrMap.size).to.be.greaterThan(0); // map should have at least one entry

    expect(sizeA).to.be.lessThan(attrMap.size); // instancing map should be larger than non-instancing map
  });

  it("should find AttributeMap using a TechniqueId with and without instancing", () => {
    let attrMap = AttributeMap.findAttributeMap(TechniqueId.Surface, false);
    const sizeA = attrMap.size;
    expect(sizeA).to.be.greaterThan(0); // map should have at least one entry

    attrMap = AttributeMap.findAttributeMap(TechniqueId.Surface, true);
    expect(attrMap.size).to.be.greaterThan(0); // map should have at least one entry

    expect(sizeA).to.be.lessThan(attrMap.size); // instancing map should be larger than non-instancing map
  });
});

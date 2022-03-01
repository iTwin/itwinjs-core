/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d } from "@itwin/core-geometry";
import { OctEncodedNormal } from "@itwin/core-common";
import { VertexKey } from "../../../render/primitives/VertexKey";

describe("VertexKey", () => {
  it("comparisons work as expected", () => {
    const key123 = new VertexKey(new Point3d(1, 2, 3), 456, new OctEncodedNormal(7));
    const copy123 = new VertexKey(new Point3d(1, 2, 3), 456, new OctEncodedNormal(7));
    const key456 = new VertexKey(new Point3d(4, 5, 6), 456, new OctEncodedNormal(7));

    expect(key123.equals(copy123)).to.be.true;
    expect(key123.equals(key456)).to.be.false;
    expect(key123.compare(copy123)).to.equal(0);
    expect(key123.compare(key456)).to.be.lessThan(0);
    expect(key456.compare(key123)).to.be.greaterThan(0);
  });
});

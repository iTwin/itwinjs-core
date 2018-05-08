/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { QPoint3d, OctEncodedNormal } from "@bentley/imodeljs-common";
import { VertexKey } from "@bentley/imodeljs-frontend/lib/rendering";

describe("VertexKey", () => {
  it("comparisons work as expected", () => {
    const key123 = new VertexKey(QPoint3d.fromScalars(1, 2, 3), 456, new OctEncodedNormal(7));
    const copy123 = new VertexKey(QPoint3d.fromScalars(1, 2, 3), 456, new OctEncodedNormal(7));
    const key456 = new VertexKey(QPoint3d.fromScalars(4, 5, 6), 456, new OctEncodedNormal(7));

    expect(key123.equals(copy123)).to.be.true;
    expect(key123.equals(key456)).to.be.false;
    expect(key123.compare(copy123)).to.equal(0);
    expect(key123.compare(key456)).to.be.lessThan(0);
    expect(key456.compare(key123)).to.be.greaterThan(0);
  });
});

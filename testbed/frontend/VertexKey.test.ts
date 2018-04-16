/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { QPoint3d } from "@bentley/imodeljs-common";
import { VertexKeyNormalAndPosition } from "@bentley/imodeljs-frontend/lib/rendering";

describe("VertexKeyNormalAndPosition", () => {
  it("VertexKeyNormalAndPosition works as expected", () => {
    const q = QPoint3d.fromScalars(10, 10, 10);
    const a = new VertexKeyNormalAndPosition(q, 10);
    assert.isTrue(a.position.isExactEqual(q), "pos is correct");
    assert.isTrue(a.normal === 10, "normal is correct");
  });
});

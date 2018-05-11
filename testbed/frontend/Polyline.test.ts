/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
// import { WebGLTestContext } from "./WebGLTestContext";
import { PolylineGeometry, PolylineArgs } from "@bentley/imodeljs-frontend/lib/rendering";
import { QPoint3dList, QParams3d } from "@bentley/imodeljs-common/lib/QPoint";
import { PolylineData } from "@bentley/imodeljs-common";
import { Range3d } from "@bentley/geometry-core/lib/Range";
import { Point3d } from "@bentley/geometry-core";

function testCreateGeometry(size: number) {
  // Create a PolylineArgs.
  const points: Point3d[] = [];
  const indices: number[] = [];
  const range = Range3d.createNull();
  const offset = (Math.random() - 0.5) * 200.0;
  const scale = (Math.random() + 0.001) * 10.0;
  for (let i = 0; i < size; ++i) {
    const x = Math.random() * scale + offset;
    const y = Math.random() * scale + offset;
    const z = Math.random() * scale + offset;
    points.push(new Point3d(x, y, z));
    indices.push(i);
  }
  for (const p of points) {
    range.extendPoint(p);
  }
  const qp = QParams3d.fromRange(range);
  const pList = new QPoint3dList(qp);
  for (const p of points) {
    pList.add(p);
  }
  const pa = new PolylineArgs(pList);
  const pa2 = new PolylineArgs(pList);
  pa2.width = 5;
  const pd = new PolylineData(indices, size, 0.0, range.high.interpolate(0.5, range.low));
  pa.polylines.push(pd);
  pa2.polylines.push(pd);
  let pg = PolylineGeometry.create(pa);
  expect(undefined === pg).to.be.false;
  pg = PolylineGeometry.create(pa2);
  expect(undefined === pg).to.be.false;
}

describe("PolylineGeometry", () => {
  it("should produce correct PolylineGeometry from PolylineGeometry.createGeometry().", () => {
    for (let i = 2; i <= 1024; i *= 2) {
      testCreateGeometry(i);
    }
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Arc3d, Loop, Path, Point2d, Point3d, Polyface, SolidPrimitive } from "@itwin/core-geometry";
import { GraphicBuilder } from "../../render/GraphicBuilder";
import { GraphicType } from "../../common/render/GraphicType";
import { GraphicPrimitive } from "../../common/render/GraphicPrimitive";
import { _implementationProhibited } from "../../common/internal/Symbols";

describe("GraphicPrimitive", () => {
  class Builder extends GraphicBuilder {
    public readonly [_implementationProhibited] = undefined;
    private _primitive?: GraphicPrimitive;

    protected set primitive(primitive: GraphicPrimitive) {
      expect(this._primitive).to.be.undefined;
      this._primitive = primitive;
    }

    public constructor() {
      super({
        computeChordTolerance: () => 1,
        type: GraphicType.Scene,
      });
    }

    public override activateGraphicParams() { }
    public override resolveGradient() { return undefined; }
    public finish() { return {} as any; }
    public finishTemplate() { return {} as any; }

    public override addLineString(points: Point3d[]) { this.primitive = { type: "linestring", points }; }
    public override addLineString2d(points: Point2d[], zDepth: number) { this.primitive = { type: "linestring2d", points, zDepth }; }
    public override addPointString(points: Point3d[]) { this.primitive = { type: "pointstring", points }; }
    public override addPointString2d(points: Point2d[], zDepth: number) { this.primitive = { type: "pointstring2d", points, zDepth }; }
    public override addShape(points: Point3d[]) { this.primitive = { type: "shape", points }; }
    public override addShape2d(points: Point2d[], zDepth: number) { this.primitive = { type: "shape2d", points, zDepth }; }
    public override addArc(arc: Arc3d, isEllipse: boolean, filled: boolean) { this.primitive = { type: "arc", arc, isEllipse, filled }; }
    public override addArc2d(arc: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number) { this.primitive = { type: "arc2d", arc, isEllipse, filled, zDepth }; }
    public override addPath(path: Path) { this.primitive = { type: "path", path }; }
    public override addLoop(loop: Loop) { this.primitive = { type: "loop", loop }; }
    public override addPolyface(polyface: Polyface, filled: boolean) { this.primitive = { type: "polyface", polyface, filled }; }
    public override addSolidPrimitive(solidPrimitive: SolidPrimitive) { this.primitive = { type: "solidPrimitive", solidPrimitive }; }

    public expectPrimitive(expected: GraphicPrimitive) {
      expect(this._primitive).not.to.be.undefined;
      expect(this._primitive).to.deep.equal(expected);
      this._primitive = undefined;
    }
  }

  it("forwards to appropriate method with appropriate arguments", () => {

    const points = [ new Point3d(0, 1, 2) ];
    const pts2d = [ new Point2d(3, 4) ];
    const zDepth = 42;
    const arc = Arc3d.createXYZXYZXYZ(1, 2, 3, 4, 5, 6, 7, 8, 9);

    type Test = [GraphicPrimitive, GraphicPrimitive | undefined];
    const tests: Test[] = [
      [ { type: "linestring", points }, undefined ],
      [ { type: "linestring2d", points: pts2d, zDepth }, undefined ],
      [ { type: "pointstring", points }, undefined ],
      [ { type: "pointstring2d", points: pts2d, zDepth }, undefined ],
      [ { type: "shape", points }, undefined ],
      [ { type: "shape2d", points: pts2d, zDepth }, undefined ],
      [ { type: "arc", arc } , { type: "arc", arc, isEllipse: false, filled: false } ],
      [ { type: "arc", arc, isEllipse: true, filled: true }, undefined ],
      [ { type: "arc", arc, isEllipse: false, filled: false }, undefined ],
      [ { type: "arc2d", zDepth, arc } , { type: "arc2d", arc, isEllipse: false, filled: false, zDepth } ],
      [ { type: "arc2d", zDepth, arc, isEllipse: true, filled: true }, undefined ],
      [ { type: "arc2d", zDepth, arc, isEllipse: false, filled: false }, undefined ],
    ];

    const builder = new Builder();
    for (const test of tests) {
      builder.addPrimitive(test[0]);
      builder.expectPrimitive(test[1] ?? test[0]);
    }
  });
});

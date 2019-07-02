/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point, Line, Circle, Annulus } from "../../ui-core/radialmenu/Annulus";

describe("Annulus", () => {

  describe("Point", () => {
    it("should default correctly", () => {
      const point = new Point();
      const point2 = new Point(0, 0);
      expect(point.equals(point2)).to.be.true;
    });
  });

  describe("Line", () => {
    it("should default correctly", () => {
      const line = new Line();
      const line2 = new Line(new Point(), new Point());
      expect(line.equals(line2)).to.be.true;
    });
  });

  describe("Circle", () => {
    it("should default correctly", () => {
      const circle = new Circle();
      const circle2 = new Circle(new Point(), 0);
      expect(circle.center.equals(circle2.center)).to.be.true;
      expect(circle.radius).to.eq(circle2.radius);
    });
  });

  describe("Annulus ", () => {
    it("should default correctly", () => {
      const annulus = new Annulus();
      const annulus2 = new Annulus(new Point(), 0, 0);
      expect(annulus.center.equals(annulus2.center)).to.be.true;
      expect(annulus.inner.center.equals(annulus2.inner.center)).to.be.true;
      expect(annulus.inner.radius).to.eq(annulus2.inner.radius);
      expect(annulus.outer.center.equals(annulus2.outer.center)).to.be.true;
      expect(annulus.outer.radius).to.eq(annulus2.outer.radius);
    });
  });

});

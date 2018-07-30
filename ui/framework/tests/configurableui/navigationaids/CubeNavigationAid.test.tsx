/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as THREE from "three";
import { CubeNavigationAid } from "@src/index";
import TestUtils from "../../TestUtils";
import { YawPitchRollAngles } from "@bentley/geometry-core";

describe("CubeNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<CubeNavigationAid />", () => {
    it("renders correctly", () => {
      shallow(<CubeNavigationAid />).should.matchSnapshot();
    });
  });
  describe("CubeNavigationAid static functions", () => {
    it("threeJSToIModelJS converts between coordinate systems correctly", () => {
      const ypr = CubeNavigationAid.threeJSToIModelJS(new THREE.Euler(Math.PI / 4, Math.PI / 2, 0));
      ypr.yaw.radians.should.equal(Math.PI / 2);
      ypr.pitch.radians.should.equal(3 * Math.PI / 4);
      ypr.roll.radians.should.equal(0);
    });
    it("iModelJSToThreeJS converts between coordinate systems correctly", () => {
      const euler = CubeNavigationAid.iModelJSToThreeJS(YawPitchRollAngles.createRadians(Math.PI / 2, Math.PI / 4 + Math.PI / 2, 0));
      euler.x.should.equal(-5 * Math.PI / 4);
      euler.y.should.equal(Math.PI / 2);
      euler.z.should.equal(0);
    });
    it("Ease function calculates expected values", () => {
      CubeNavigationAid.easeFn(0).should.equal(0);
      CubeNavigationAid.easeFn(1).should.equal(1);
      (Math.round(CubeNavigationAid.easeFn(.5) * 1e15) / 1e15).should.equal(.5);
    });
    it("normalizeAngle correctly wraps angles to (-pi, pi] interval.", () => {
      CubeNavigationAid.normalizeAngle(Math.PI / 2).should.equal(Math.PI / 2);
      CubeNavigationAid.normalizeAngle(5 * Math.PI / 2).should.equal(Math.PI / 2);
      CubeNavigationAid.normalizeAngle(9 * Math.PI / 2).should.equal(Math.PI / 2);

      CubeNavigationAid.normalizeAngle(-Math.PI / 2).should.equal(-Math.PI / 2);
      CubeNavigationAid.normalizeAngle(-5 * Math.PI / 2).should.equal(-Math.PI / 2);
      CubeNavigationAid.normalizeAngle(-9 * Math.PI / 2).should.equal(-Math.PI / 2);
    });
    it("almostEqual returns true only for angular movements within 0.001 threshold", () => {
      CubeNavigationAid.almostEqual(new THREE.Euler(0, 0, 0), new THREE.Euler(0, 0, 0.001)).should.equal(false);
      CubeNavigationAid.almostEqual(new THREE.Euler(0, 0, 0), new THREE.Euler(0, 0, 0.000999)).should.equal(true);
      CubeNavigationAid.almostEqual(new THREE.Euler(0, 0, 0), new THREE.Euler(0.001 / Math.SQRT2, 0.001 / Math.SQRT2, 0)).should.equal(false);
      CubeNavigationAid.almostEqual(new THREE.Euler(0, 0, 0), new THREE.Euler(0.000999 / Math.SQRT2, 0.000999 / Math.SQRT2, 0)).should.equal(true);
    });
  });
});

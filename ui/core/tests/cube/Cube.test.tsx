/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { RotMatrix } from "@bentley/geometry-core";
import { Cube } from "../../src/index";

describe("Cube", () => {
  describe("<Cube />", () => {
    it("should render", () => {
      const r = RotMatrix.createIdentity();
      mount(<Cube rotMatrix={r} />);
    });
    it("renders correctly", () => {
      const r = RotMatrix.createIdentity();
      shallow(<Cube rotMatrix={r} />).should.matchSnapshot();
    });
  });
});

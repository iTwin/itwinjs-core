/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Matrix3d } from "@bentley/geometry-core";
import { Cube } from "../../src/index";

describe("Cube", () => {
  describe("<Cube />", () => {
    it("should render", () => {
      const r = Matrix3d.createIdentity();
      mount(<Cube rotMatrix={r} />);
    });
    it("renders correctly", () => {
      const r = Matrix3d.createIdentity();
      shallow(<Cube rotMatrix={r} />).should.matchSnapshot();
    });
  });
});

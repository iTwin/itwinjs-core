/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { Outline } from "../../ui-framework/zones/Outline";

describe("Outline", () => {
  it("should mount", () => {
    mount(<Outline />);
  });

  it("renders correctly", () => {
    shallow(<Outline bounds={{
      bottom: 10,
      left: 0,
      right: 20,
      top: 0,
    }} />).should.matchSnapshot();
  });

  it("does not render w/o bounds", () => {
    shallow(<Outline />).should.matchSnapshot();
  });
});

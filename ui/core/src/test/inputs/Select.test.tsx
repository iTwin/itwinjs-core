/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Select } from "../../ui-core";

describe("<Select />", () => {
  it("should render", () => {
    mount(<Select options={[]} />);
  });

  it("renders correctly", () => {
    shallow(<Select options={[]} />).should.matchSnapshot();
  });

  it("renders status correctly", () => {
    shallow(<Select options={[]} />).should.matchSnapshot();
  });

  it("renders placeholder correctly", () => {
    shallow(<Select options={[]} placeholder="test" />).should.matchSnapshot();
  });

  it("renders array options correctly", () => {
    shallow(<Select options={["Option 1", "Option 2", "Option 3"]} />).should.matchSnapshot();
  });

  it("renders object options correctly", () => {
    shallow(<Select options={{ option1: "Option 1", option2: "Option 2", option3: "Option3" }} />).should.matchSnapshot();
  });
});

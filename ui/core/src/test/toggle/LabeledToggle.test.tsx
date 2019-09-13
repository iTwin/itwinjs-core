/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { LabeledToggle } from "../../ui-core";

describe("<LabeledToggle />", () => {
  it("should render", () => {
    mount(<LabeledToggle label="toggle test" />);
  });

  it("renders correctly", () => {
    shallow(<LabeledToggle label="toggle test" />).should.matchSnapshot();
  });

  it("renders disabled correctly", () => {
    shallow(<LabeledToggle label="toggle test" disabled />).should.matchSnapshot();
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { ToolAssistanceInstruction } from "../../../ui-ninezone";

describe("<ToolAssistanceInstruction />", () => {
  it("should render", () => {
    mount(<ToolAssistanceInstruction image="icon-placeholder" text="Test" />);
  });

  it("renders correctly", () => {
    shallow(<ToolAssistanceInstruction image="icon-placeholder" text="Test" />).should.matchSnapshot();
  });

  it("should render correctly with new", () => {
    mount(<ToolAssistanceInstruction image="icon-placeholder" text="Test" isNew />).should.matchSnapshot();
  });

  it("renders correctly with new", () => {
    shallow(<ToolAssistanceInstruction image="icon-placeholder" text="Test" isNew />).should.matchSnapshot();
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ContextMenu } from "../../src/index";

describe("<ContextMenu />", () => {
  it("should render", () => {
    mount(<ContextMenu opened={true} />);
  });

  it("renders correctly", () => {
    shallow(<ContextMenu opened={true} />).should.matchSnapshot();
  });
});

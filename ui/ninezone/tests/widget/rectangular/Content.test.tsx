/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Content from "../../../src/widget/rectangular/Content";
import { HorizontalAnchor } from "../../../src/widget/Stacked";

describe("<Content />", () => {
  it("should render", () => {
    mount(<Content anchor={HorizontalAnchor.Right} />);
  });

  it("renders correctly", () => {
    shallow(<Content anchor={HorizontalAnchor.Right} />).should.matchSnapshot();
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { RadialMenu } from "../../src/index";

describe("<RadialMenu />", () => {
  it("should render", () => {
    mount(
      <RadialMenu
        opened={true}
        left={100}
        top={100}
        innerRadius={10}
        outerRadius={100}
      />,
    );
  });

  it("renders correctly", () => {
    shallow(
      <RadialMenu
        opened={true}
        left={100}
        top={100}
        innerRadius={10}
        outerRadius={100}
      />,
    ).should.matchSnapshot();
  });
});

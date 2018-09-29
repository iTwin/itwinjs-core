/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Content from "../../../src/footer/message-center/Content";

describe("<Content />", () => {
  it("should render", () => {
    mount(<Content />);
  });

  it("renders correctly", () => {
    shallow(<Content />).should.matchSnapshot();
  });
});

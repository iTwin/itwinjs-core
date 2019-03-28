/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { StatusMessage, Status } from "../../../../../ui-ninezone";

describe("<StatusMessage />", () => {
  it("should render", () => {
    mount(<StatusMessage status={Status.Error} />);
  });

  it("renders correctly", () => {
    shallow(<StatusMessage status={Status.Error} />).should.matchSnapshot();
  });
});

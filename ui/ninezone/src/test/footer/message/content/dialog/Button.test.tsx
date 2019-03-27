/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { DialogButton } from "../../../../../ui-ninezone";

describe("<DialogButton />", () => {
  it("should render", () => {
    mount(<DialogButton />);
  });

  it("renders correctly", () => {
    shallow(<DialogButton />).should.matchSnapshot();
  });
});

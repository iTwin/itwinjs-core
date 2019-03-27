/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageButton } from "../../../../ui-ninezone";

describe("<MessageButton />", () => {
  it("should render", () => {
    mount(<MessageButton />);
  });

  it("renders correctly", () => {
    shallow(<MessageButton />).should.matchSnapshot();
  });
});

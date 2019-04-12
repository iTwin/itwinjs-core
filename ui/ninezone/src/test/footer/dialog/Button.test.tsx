/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { TitleBarButton } from "../../../ui-ninezone";

describe("<TitleBarButton />", () => {
  it("should render", () => {
    mount(<TitleBarButton />);
  });

  it("renders correctly", () => {
    shallow(<TitleBarButton />).should.matchSnapshot();
  });
});

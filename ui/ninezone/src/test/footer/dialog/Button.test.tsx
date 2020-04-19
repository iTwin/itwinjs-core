/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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

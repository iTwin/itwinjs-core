/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { TitleBarButton } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

describe("<TitleBarButton />", () => {
  it("should render", () => {
    mount(<TitleBarButton />);
  });

  it("renders correctly", () => {
    shallow(<TitleBarButton />).should.matchSnapshot();
  });
});

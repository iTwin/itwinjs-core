/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageButton } from "../../../ui-ninezone";
import { mount } from "../../Utils";

describe("<MessageButton />", () => {
  it("should render", () => {
    mount(<MessageButton />);
  });

  it("renders correctly", () => {
    shallow(<MessageButton />).should.matchSnapshot();
  });
});

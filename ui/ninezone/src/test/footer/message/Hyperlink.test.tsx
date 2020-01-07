/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageHyperlink } from "../../../ui-ninezone";

describe("<MessageHyperlink />", () => {
  it("should render", () => {
    mount(<MessageHyperlink />);
  });

  it("renders correctly", () => {
    shallow(<MessageHyperlink />).should.matchSnapshot();
  });
});

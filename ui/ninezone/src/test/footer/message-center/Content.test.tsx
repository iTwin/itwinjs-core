/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageCenterContent } from "../../../ui-ninezone";

describe("<Content />", () => {
  it("should render", () => {
    mount(<MessageCenterContent />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterContent />).should.matchSnapshot();
  });
});

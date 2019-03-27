/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { DialogContent } from "../../../../../../ui-ninezone";

describe("<DialogContent  />", () => {
  it("should render", () => {
    mount(<DialogContent />);
  });

  it("renders correctly", () => {
    shallow(<DialogContent />).should.matchSnapshot();
  });
});

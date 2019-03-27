/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { ScrollableContent } from "../../../../../../ui-ninezone";

describe("<ScrollableContent  />", () => {
  it("should render", () => {
    mount(<ScrollableContent />);
  });

  it("renders correctly", () => {
    shallow(<ScrollableContent />).should.matchSnapshot();
  });
});

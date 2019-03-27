/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Progress, Status } from "../../../../ui-ninezone";

describe("<Progress />", () => {
  it("should render", () => {
    mount(<Progress progress={10} status={Status.Error} />);
  });

  it("renders correctly", () => {
    shallow(<Progress progress={20} status={Status.Information} />).should.matchSnapshot();
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Separator from "../../src/backstage/Separator";

describe("<Separator />", () => {
  it("should render", () => {
    mount(<Separator />);
  });

  it("renders correctly", () => {
    shallow(<Separator />).should.matchSnapshot();
  });
});

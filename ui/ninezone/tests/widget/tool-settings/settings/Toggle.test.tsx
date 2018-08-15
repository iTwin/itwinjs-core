/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Toggle from "@src/widget/tool-settings/settings/Toggle";

describe("<Toggle />", () => {
  it("should render", () => {
    mount(<Toggle />);
  });

  it("renders correctly", () => {
    shallow(<Toggle />).should.matchSnapshot();
  });
});

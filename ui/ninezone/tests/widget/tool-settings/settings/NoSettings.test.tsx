/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import NoSettings from "@src/widget/tool-settings/settings/NoSettings";

describe("<NoSettings />", () => {
  it("should render", () => {
    mount(<NoSettings />);
  });

  it("renders correctly", () => {
    shallow(<NoSettings />).should.matchSnapshot();
  });
});

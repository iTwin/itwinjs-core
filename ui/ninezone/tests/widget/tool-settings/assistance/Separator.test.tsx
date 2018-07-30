/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Separator from "@src/widget/tool-settings/assistance/Separator";

describe("<Separator />", () => {
  it("should render", () => {
    mount(<Separator />);
  });

  it("renders correctly", () => {
    shallow(<Separator />).should.matchSnapshot();
  });
});

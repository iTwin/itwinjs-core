/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Toast, { Stage } from "@src/footer/message/Toast";

describe("<Toast />", () => {
  it("should render", () => {
    mount(<Toast stage={Stage.Visible} />);
  });

  it("renders correctly", () => {
    shallow(<Toast stage={Stage.Visible} />).should.matchSnapshot();
  });
});

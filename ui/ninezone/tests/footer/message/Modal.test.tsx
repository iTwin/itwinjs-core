/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Modal from "@src/footer/message/Modal";

describe("<Modal />", () => {
  it("should render", () => {
    mount(<Modal />);
  });

  it("renders correctly", () => {
    shallow(<Modal />).should.matchSnapshot();
  });
});

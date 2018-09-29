/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Modal from "../../../src/footer/message/Modal";

describe("<Modal />", () => {
  it("should render", () => {
    mount(<Modal />);
  });

  it("renders correctly", () => {
    shallow(<Modal />).should.matchSnapshot();
  });
});

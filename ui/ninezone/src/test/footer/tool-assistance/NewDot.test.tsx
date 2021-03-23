/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { NewDot } from "../../../ui-ninezone/footer/tool-assistance/NewDot.js";
import { mount } from "../../Utils.js";

describe("<NewDot />", () => {
  it("should render", () => {
    mount(<NewDot />);
  });

  it("renders correctly", () => {
    shallow(<NewDot />).should.matchSnapshot();
  });
});

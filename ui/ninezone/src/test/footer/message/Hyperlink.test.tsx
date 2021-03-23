/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { MessageHyperlink } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

describe("<MessageHyperlink />", () => {
  it("should render", () => {
    mount(<MessageHyperlink />);
  });

  it("renders correctly", () => {
    shallow(<MessageHyperlink />).should.matchSnapshot();
  });
});

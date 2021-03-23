/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { MessageCenter } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

describe("<MessageCenter />", () => {
  it("should render", () => {
    mount(<MessageCenter />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenter />).should.matchSnapshot();
  });

  it("renders correctly with label", () => {
    shallow(<MessageCenter label="Messages:" />).should.matchSnapshot();
  });
});

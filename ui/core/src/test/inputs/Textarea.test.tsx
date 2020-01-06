/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Textarea } from "../../ui-core";

describe("<Textarea />", () => {
  it("should render", () => {
    mount(<Textarea />);
  });

  it("renders correctly", () => {
    shallow(<Textarea />).should.matchSnapshot();
  });

  it("renders rows correctly", () => {
    shallow(<Textarea rows={30} />).should.matchSnapshot();
  });
});

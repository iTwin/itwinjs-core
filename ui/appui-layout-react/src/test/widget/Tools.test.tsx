/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { Tools } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<Tools />", () => {
  it("should render", () => {
    mount(<Tools />);
  });

  it("renders correctly", () => {
    shallow(<Tools />).should.matchSnapshot();
  });

  it("renders navigation correctly", () => {
    shallow(<Tools isNavigation />).should.matchSnapshot();
  });

  it("renders correctly with out gap", () => {
    shallow(<Tools verticalToolbar="" />).should.matchSnapshot();
  });

  it("renders correctly with reduced gap", () => {
    shallow(<Tools preserveSpace />).should.matchSnapshot();
  });
});

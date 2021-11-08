/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ExpandableItem } from "../../../../appui-layout-react";
import { mount } from "../../../Utils";

describe("<ExpandableItem />", () => {
  it("should render", () => {
    mount(<ExpandableItem />);
  });

  it("renders correctly", () => {
    shallow(<ExpandableItem />).should.matchSnapshot();
  });

  it("renders active correctly", () => {
    shallow(<ExpandableItem isActive />).dive().should.matchSnapshot();
  });

  it("renders disabled correctly", () => {
    shallow(<ExpandableItem isDisabled />).dive().should.matchSnapshot();
  });

  it("renders w/o indicator correctly", () => {
    shallow(<ExpandableItem hideIndicator />).dive().should.matchSnapshot();
  });
});

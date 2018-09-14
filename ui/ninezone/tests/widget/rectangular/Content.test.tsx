/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Content from "../../../src/widget/rectangular/Content";
import { HorizontalAnchor } from "../../../src/widget/Stacked";

describe("<Content />", () => {
  it("should render", () => {
    mount(<Content anchor={HorizontalAnchor.Right} />);
  });

  it("renders correctly", () => {
    shallow(<Content anchor={HorizontalAnchor.Right} />).should.matchSnapshot();
  });
});

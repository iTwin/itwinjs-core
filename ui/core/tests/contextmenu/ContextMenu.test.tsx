/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ContextMenu } from "@src/index";

describe("<ContextMenu />", () => {
  it("should render", () => {
    mount(<ContextMenu opened={true} />);
  });

  it("renders correctly", () => {
    shallow(<ContextMenu opened={true} />).should.matchSnapshot();
  });
});

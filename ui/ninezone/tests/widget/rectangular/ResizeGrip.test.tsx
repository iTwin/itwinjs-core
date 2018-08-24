/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import ResizeGrip, { ResizeDirection } from "../../../src/widget/rectangular/ResizeGrip";

describe("<ResizeGrip />", () => {
  it("should render", () => {
    mount(<ResizeGrip direction={ResizeDirection.EastWest} />);
  });

  it("renders correctly", () => {
    shallow(<ResizeGrip direction={ResizeDirection.EastWest} />).should.matchSnapshot();
  });
});

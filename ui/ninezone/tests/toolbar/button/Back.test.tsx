/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import BackButton from "../../../src/toolbar/button/Back";

describe("<BackButton />", () => {
  it("should render", () => {
    mount(<BackButton />);
  });

  it("renders correctly", () => {
    shallow(<BackButton />).should.matchSnapshot();
  });
});

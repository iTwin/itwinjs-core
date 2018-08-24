/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Back from "../../../src/zones/target/Back";

describe("<Back />", () => {
  it("should render", () => {
    mount(<Back />);
  });

  it("renders correctly", () => {
    shallow(<Back />).should.matchSnapshot();
  });
});

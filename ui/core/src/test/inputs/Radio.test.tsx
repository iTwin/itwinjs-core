/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Radio, InputStatus } from "../../ui-core";

describe("<Radio />", () => {
  it("should render", () => {
    mount(<Radio label="radio test" />);
  });

  it("renders correctly", () => {
    shallow(<Radio label="radio test" />).should.matchSnapshot();
  });

  it("renders status correctly", () => {
    shallow(<Radio label="radio test" status={InputStatus.Success} />).should.matchSnapshot();
  });
});

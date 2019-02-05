/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { LabeledInput, InputStatus } from "../../ui-core";

describe("<LabeledInput />", () => {
  it("should render", () => {
    mount(<LabeledInput label="input test" />);
  });

  it("renders correctly", () => {
    shallow(<LabeledInput label="input test" />).should.matchSnapshot();
  });

  it("renders status correctly", () => {
    shallow(<LabeledInput label="input test" status={InputStatus.Success} />).should.matchSnapshot();
  });

  it("renders message correctly", () => {
    shallow(<LabeledInput label="input test" message="Test message" />).should.matchSnapshot();
  });
});

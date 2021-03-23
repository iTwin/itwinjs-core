/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { InputStatus, LabeledInput } from "../../ui-core.js";

describe("<LabeledInput />", () => {
  it("should render", () => {
    mount(<LabeledInput label="input test" />);
  });

  it("renders correctly", () => {
    shallow(<LabeledInput label="input test" />).should.matchSnapshot();
  });

  it("renders disabled correctly", () => {
    shallow(<LabeledInput label="input test" disabled />).should.matchSnapshot();
  });

  it("renders status correctly", () => {
    shallow(<LabeledInput label="input test" status={InputStatus.Success} />).should.matchSnapshot();
  });

  it("renders message correctly", () => {
    shallow(<LabeledInput label="input test" message="Test message" />).should.matchSnapshot();
  });
});

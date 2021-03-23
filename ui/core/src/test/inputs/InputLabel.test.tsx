/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { InputLabel, InputStatus } from "../../ui-core.js";

describe("<InputLabel />", () => {
  it("should render", () => {
    mount(<InputLabel label="input test" />);
  });

  it("renders correctly", () => {
    shallow(<InputLabel label="input test" />).should.matchSnapshot();
  });

  it("renders disabled correctly", () => {
    shallow(<InputLabel label="input test" disabled={true} />).should.matchSnapshot();
  });

  it("renders status correctly", () => {
    shallow(<InputLabel label="input test" status={InputStatus.Success} />).should.matchSnapshot();
  });

  it("renders message correctly", () => {
    shallow(<InputLabel label="input test" message="Test message" />).should.matchSnapshot();
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Tools } from "../../ui-ninezone";

describe("<Tools />", () => {
  it("should render", () => {
    mount(<Tools />);
  });

  it("renders correctly", () => {
    shallow(<Tools />).should.matchSnapshot();
  });

  it("renders navigation correctly", () => {
    shallow(<Tools isNavigation />).should.matchSnapshot();
  });

  it("renders correctly with out gap", () => {
    shallow(<Tools verticalToolbar={""} />).should.matchSnapshot();
  });

  it("renders correctly with reduced gap", () => {
    shallow(<Tools preserveSpace />).should.matchSnapshot();
  });
});

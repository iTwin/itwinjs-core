/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { withTimeout, Div } from "../../ui-core";

describe("withTimeout", () => {

  const WithTimeoutDiv = withTimeout(Div); // tslint:disable-line:variable-name

  it("should render", () => {
    const wrapper = mount(<WithTimeoutDiv timeout={1} onTimeout={() => { }} />);
    setTimeout(() => {
      wrapper.update();
      wrapper.unmount();
    }, 2);
  });

  it("renders correctly", () => {
    shallow(<WithTimeoutDiv timeout={100} />).should.matchSnapshot();
  });

});

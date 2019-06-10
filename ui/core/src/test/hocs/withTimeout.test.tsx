/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { withTimeout } from "../../ui-core";

describe("withTimeout", () => {

  const WithTimeoutDiv = withTimeout((props) => (<div {...props} />)); // tslint:disable-line:variable-name

  it("should render", () => {
    const wrapper = mount(<WithTimeoutDiv timeout={1} onTimeout={() => { }} />);
    setTimeout(() => {
      wrapper.unmount();
    }, 2);
  });

  it("renders correctly", () => {
    shallow(<WithTimeoutDiv timeout={100} />).should.matchSnapshot();
  });

  it("should start timer on update", () => {
    const wrapper = mount(<WithTimeoutDiv timeout={1} onTimeout={() => { }} />);
    setTimeout(() => {
      wrapper.setProps({ timeout: 2 });
      wrapper.unmount();
    }, 2);
  });

  it("should ignore update if timer running", () => {
    const wrapper = mount(<WithTimeoutDiv timeout={1} onTimeout={() => { }} />);
    wrapper.setProps({ timeout: 2 });
    setTimeout(() => {
      wrapper.unmount();
    }, 2);
  });

});

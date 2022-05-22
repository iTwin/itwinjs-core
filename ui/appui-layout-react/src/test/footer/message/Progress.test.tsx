/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageProgress, Status } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<MessageProgress />", () => {
  it("should render", () => {
    mount(<MessageProgress progress={10} status={Status.Error} />);
  });

  it("renders correctly", () => {
    shallow(<MessageProgress progress={20} status={Status.Information} />).should.matchSnapshot();
  });
});

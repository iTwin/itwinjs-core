/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { MessageProgress, Status } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

describe("<MessageProgress />", () => {
  it("should render", () => {
    mount(<MessageProgress progress={10} status={Status.Error} />);
  });

  it("renders correctly", () => {
    shallow(<MessageProgress progress={20} status={Status.Information} />).should.matchSnapshot();
  });
});

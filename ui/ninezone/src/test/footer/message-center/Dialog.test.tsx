/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageCenterDialog, MessageCenterDialogContent } from "../../../ui-ninezone";

describe("<MessageCenterDialog />", () => {
  it("should render", () => {
    mount(<MessageCenterDialog />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterDialog />).should.matchSnapshot();
  });
});

describe("<MessageCenterDialogContent />", () => {
  it("should render", () => {
    mount(<MessageCenterDialogContent />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterDialogContent />).should.matchSnapshot();
  });
});

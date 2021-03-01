/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount, ReactWrapper } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { MapUrlDialog } from "../ui/widget/MapUrlDialog";
import { TestUtils } from "./TestUtils";

describe("MapUrlDialog", () => {

  before(async () => {
    await TestUtils.initialize();
  });

  afterEach(() => {

  });

  const handleModalUrlDialogOk = () => {
  };

  it("renders", () => {
    const wrapper = mount(<MapUrlDialog isOverlay={false} onOkResult={handleModalUrlDialogOk} />);

    wrapper.unmount();
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup } from "react-testing-library";
import { expect } from "chai";
import * as sinon from "sinon";

import { InlineEdit } from "../../ui-components/timeline/InlineEdit";

describe("<InlineEdit />", () => {
  afterEach(() => {
    afterEach(cleanup);
  });

  it("trigger call to componentWillReceiveProps", async () => {
    const onTotalDurationChange = sinon.spy();
    const initialDuration = "00:40";
    const revisedDuration = "00:60";

    const renderedComponent = render(<InlineEdit className="end-time" defaultValue={initialDuration} onChange={onTotalDurationChange} />);
    expect(renderedComponent).not.to.be.undefined;

    // trigger call to componentWillReceiveProps
    renderedComponent.rerender(<InlineEdit className="end-time" defaultValue={revisedDuration} onChange={onTotalDurationChange} />);
  });
});

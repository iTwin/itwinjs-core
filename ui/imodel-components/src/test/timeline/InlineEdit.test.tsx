/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { InlineEdit } from "../../imodel-components-react/timeline/InlineEdit";

describe("<InlineEdit />", () => {
  afterEach(() => {

  });

  it("trigger call to componentDidUpdate", async () => {
    const onTotalDurationChange = sinon.spy();
    const initialDuration = "00:40";
    const revisedDuration = "00:60";

    const renderedComponent = render(<InlineEdit className="end-time" defaultValue={initialDuration} onChange={onTotalDurationChange} />);
    expect(renderedComponent).not.to.be.undefined;

    // trigger call to componentDidUpdate
    renderedComponent.rerender(<InlineEdit className="end-time" defaultValue={revisedDuration} onChange={onTotalDurationChange} />);
  });
});

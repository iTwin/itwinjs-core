/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { NineZoneProvider, createNineZoneState } from "../../ui-ninezone";

describe("<NineZoneProvider />", () => {
  it("renders correctly", () => {
    const nineZone = createNineZoneState();
    const { container } = render(<NineZoneProvider
      state={nineZone}
      dispatch={sinon.spy()}
    >
      9-Zone
    </NineZoneProvider>);
    container.firstChild!.should.matchSnapshot();
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import NineZone, { getDefaultProps } from "../../../src/zones/state/NineZone";

const defaultProps = getDefaultProps();

describe("NineZone", () => {
  it("should construct an instance", () => {
    new NineZone(defaultProps);
  });
});

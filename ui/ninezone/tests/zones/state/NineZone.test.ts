/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import NineZone, { getDefaultProps } from "../../../src/zones/state/NineZone";

const defaultProps = getDefaultProps();

describe("NineZone", () => {
  it("should construct an instance", () => {
    new NineZone(defaultProps);
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CoordinatesUtils } from "../../../tile/internal";
import { expect } from "chai";

describe.only("CoordinatesUtils", () => {
  it.only("should deflate coordinates array", async () => {
    // Simple deflate stride = 2
    let doubleArray = [[1, 2], [3, 4]];
    let deflated: number[] = [];
    let offset = CoordinatesUtils.deflateCoordinates(doubleArray, deflated, 2, 0);
    expect(offset).to.equals(4);
    expect(deflated).to.eql([1, 2, 3, 4]);

    /// Check offset with stride = 2
    doubleArray = [[5, 6]];
    offset = CoordinatesUtils.deflateCoordinates(doubleArray, deflated, 2, offset);
    expect(offset).to.equals(6);
    expect(deflated).to.eql([1, 2, 3, 4, 5, 6]);

    // Simple deflate stride = 3
    doubleArray = [[1, 2, 3], [4, 5, 6]];
    deflated = [];
    offset = CoordinatesUtils.deflateCoordinates(doubleArray, deflated, 3, 0);
    expect(offset).to.equals(6);
    expect(deflated).to.eql([1, 2, 3, 4, 5, 6]);

    /// Check offset with stride = 3
    doubleArray = [[7, 8, 9]];
    offset = CoordinatesUtils.deflateCoordinates(doubleArray, deflated, 3, offset);
    expect(offset).to.equals(9);
    expect(deflated).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { getBestBWContrastColor } from "../../core-react";

const COLORS = [
  "#6ab9ec",
  "#b1c854",
  "#f7706c",
  "#4585a5",
  "#ffc335",
  "#f7963e",
  "#73c7c1",
  "#85a9cf",
  "#a3779f",
  "#c8c2b4",
  "#a47854",
];

const CONTRAST = [
  "black",
  "black",
  "black",
  "white",
  "black",
  "black",
  "black",
  "black",
  "black",
  "black",
  "black",
];

describe("getBestBWContrastColor", () => {
  it("should return correct contrast color", () => {
    COLORS.forEach((_, index) => {
      const color = COLORS[index];
      const contrast = getBestBWContrastColor(color);
      if (contrast !== CONTRAST[index])
        console.log(`getBestBWContrastColor failed on ${color}`); // eslint-disable-line no-console
      expect(contrast).to.eq(CONTRAST[index]);
    });
  });
});

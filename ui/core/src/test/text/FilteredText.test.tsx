/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import { cleanup, render } from "@testing-library/react";
import { FilteredText } from "../../ui-core";

const value = "That he's mad, tis true, tis true tis pity, And pity tis, tis true";
const matches = [
  { start: 15, end: 18 },
  { start: 25, end: 28 },
  { start: 34, end: 37 },
  { start: 53, end: 56 },
  { start: 58, end: 61 },
];

describe("<FilteredText />", () => {
  afterEach(cleanup);

  it("should render", async () => {
    const wrapper = render(<FilteredText value={"Hello World!"} />);
    const foundText = await wrapper.findAllByText("Hello World!");
    expect(foundText.length).to.eq(1);
  });

  it("should render matches", async () => {
    const wrapper = render(<FilteredText value={value} matches={matches} />);
    const foundTis = await wrapper.findAllByText("tis");
    expect(foundTis.length).to.eq(5);
  });

  it("should render matches with specified class name", async () => {
    const wrapper = render(<FilteredText value={value} matches={matches} matchClassName={"matching-tis"} />);
    const foundTis = await wrapper.findAllByText("tis");
    expect(foundTis.length).to.eq(5);
    const foundMatches = foundTis[0].className.match("matching-tis");
    expect(foundMatches).not.to.be.null;
  });

  it("should render matches with specified style", async () => {
    const wrapper = render(<FilteredText value={value} matches={matches} matchStyle={{ color: "orange" }} />);
    const foundTis = await wrapper.findAllByText("tis");
    expect(foundTis.length).to.eq(5);
    const foundMatches = foundTis[0].className.match("uicore-filtered-text-match");
    expect(foundMatches).not.to.be.null;
    const matchColor = foundTis[0].style.color;
    expect(matchColor).to.eq("orange");
  });

});

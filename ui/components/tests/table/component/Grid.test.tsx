/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";

import { Grid } from "../../../src";

const columns = [
  { key: "id", name: "ID" },
  { key: "title", name: "Title" },
  { key: "count", name: "Count" },
];

interface RowDef {
  id: number;
  title: string;
  count: number;
}

const rows: RowDef[] = [];
const NUM_ROWS = 100;

const createRows = (): RowDef[] => {
  for (let i = 1; i <= NUM_ROWS; i++) {
    rows.push({
      id: i,
      title: "Title " + i,
      count: i * 1000,
    });
  }
  return rows;
};

describe("Grid", () => {
  it("should render", () => {
    mount(<Grid columns={columns} rows={createRows()} />);
  });

  it("renders correctly", () => {
    shallow(<Grid columns={columns} rows={createRows()} />).should.matchSnapshot();
  });

  it("should select first row", () => {
    const wrapper = mount(<Grid columns={columns} rows={createRows()} />);
    expect(wrapper.state("selectedRow")).to.eq(undefined);

    const rowDiv = wrapper.find("div.react-grid-Row").at(0);
    const cellDiv = rowDiv.find("div.react-grid-Cell").at(0);
    cellDiv.simulate("click");
    expect(wrapper.state("selectedRow")).to.eq(0);
    wrapper.update();

    cellDiv.simulate("click");
    expect(wrapper.state("selectedRow")).to.eq(undefined);
  });

});

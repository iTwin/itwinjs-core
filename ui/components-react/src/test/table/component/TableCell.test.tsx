/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { PropertyValueRendererManager } from "../../../components-react/properties/ValueRendererManager";
import { TableCell, TableCellContent, TableIconCellContent } from "../../../components-react/table/component/TableCell";
import { CellItem } from "../../../components-react/table/TableDataProvider";
import TestUtils from "../../TestUtils";

describe("TableCell", () => {
  it("renders content", () => {
    const cell = render(<TableCell title="test-cell">Test text</TableCell>);

    expect(cell.container.firstChild).to.not.be.empty;
    expect((cell.container.firstChild! as HTMLElement).title).to.equal("test-cell");
    cell.getByText("Test text");
  });

  it("calls appropriate callbacks on event triggers", () => {
    const clickStub = sinon.stub();
    const mouseMoveStub = sinon.stub();
    const mouseDownStub = sinon.stub();

    const cell = render(
      <TableCell
        onClick={clickStub}
        onMouseMove={mouseMoveStub}
        onMouseDown={mouseDownStub}
        title="test-cell"
      >
        Test text
      </TableCell>);

    fireEvent.click(cell.container);
    expect(clickStub.calledOnce);

    fireEvent.mouseDown(cell.container);
    expect(mouseDownStub.calledOnce);

    fireEvent.mouseMove(cell.container);
    expect(mouseMoveStub.calledOnce);
  });

  it("renders editor container when editing props are provided", () => {
    const record = TestUtils.createPrimitiveStringProperty("test", "test");

    const cell = render(
      <TableCell
        cellEditingProps={{
          onCancel: sinon.stub(),
          onCommit: sinon.stub(),
          propertyRecord: record,
        }}
        title="test-cell"
      />);

    cell.getByTestId("editor-container");
  });
});

describe("TableCellContent", () => {
  const key = "test-cell-item";

  it("renders", async () => {
    const record = TestUtils.createPrimitiveStringProperty("Label", "Test property");

    const cellItem: CellItem = { key, record };

    const content = render(
      <TableCellContent
        cellItem={cellItem}
        isSelected={false}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    expect(content.container.firstChild).to.not.be.empty;
    expect((content.container.firstChild! as HTMLElement).innerHTML).to.be.empty;

    await waitFor(() => content.getByText("Test property"));
  });

  it("renders when property record is not provided", () => {
    const cellItem: CellItem = { key };

    const content = render(
      <TableCellContent
        cellItem={cellItem}
        isSelected={false}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    expect(content.container.firstChild).to.not.be.empty;
    expect((content.container.firstChild! as HTMLElement).innerHTML).to.be.empty;
  });

  // Fails sporadically after React 17 upgrade
  it.skip("rerenders when props update", async () => {
    let record = TestUtils.createPrimitiveStringProperty("Label", "Test property");
    let cellItem: CellItem = { key, record };

    const content = render(
      <TableCellContent
        cellItem={cellItem}
        isSelected={false}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    record = TestUtils.createPrimitiveStringProperty("Label", "Changed property");
    cellItem = { key, record };
    content.rerender(
      <TableCellContent
        cellItem={cellItem}
        isSelected={false}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    await waitFor(() => content.getByText("Changed property"));
  });
});

describe("TableIconCellContent", () => {
  it("renders", () => {
    const content = render(<TableIconCellContent iconName="test-icon" />);

    expect(content.container.querySelector(".test-icon")).to.not.be.empty;
  });
});

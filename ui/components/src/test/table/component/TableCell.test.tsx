import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import { render, fireEvent, waitForElement } from "react-testing-library";
import { TableIconCellContent, TableCell, TableCellContent } from "../../../ui-components/table/component/TableCell";
import { PropertyValueRendererManager } from "../../../ui-components/properties/ValueRendererManager";
import { CellItem } from "../../../ui-components/table/TableDataProvider";
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

    await waitForElement(() => content.getByText("Test property"));
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

  it("rerenders when props update", async () => {
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

    await waitForElement(() => content.getByText("Changed property"));
  });

  it("renders style", () => {
    const cellItem: CellItem = {
      key,
      isBold: true,
      isItalic: true,
      alignment: "left",
    };

    const content = render(
      <TableCellContent
        cellItem={cellItem}
        isSelected={false}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    const innerElement = content.container.firstChild as HTMLElement;
    expect(innerElement).to.not.be.empty;
    expect(innerElement.style.fontWeight).to.equal("bold");
    expect(innerElement.style.fontStyle).to.equal("italic");
    expect(innerElement.style.textAlign).to.equal("left");
  });

  it("renders style with overriden colors", () => {
    const cellItem: CellItem = {
      key,
      colorOverrides: {
        backColor: 0xFF0000,
        foreColor: 0xAA0000,
      },
    };

    const content = render(
      <TableCellContent
        cellItem={cellItem}
        isSelected={false}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    const innerElement = content.container.firstChild as HTMLElement;
    expect(innerElement).to.not.be.empty;

    expect(innerElement.style.backgroundColor).to.equal("rgb(255, 0, 0)");
    expect(innerElement.style.color).to.equal("rgb(170, 0, 0)");
  });

  it("renders no style when overriden colors is an empty object", () => {
    const cellItem: CellItem = { key, colorOverrides: {} };

    const content = render(
      <TableCellContent
        cellItem={cellItem}
        isSelected={false}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    const innerElement = content.container.firstChild as HTMLElement;
    expect(innerElement).to.not.be.empty;

    expect(innerElement.style.color).to.be.empty;
    expect(innerElement.style.backgroundColor).to.be.empty;
  });

  it("renders style with overriden selection colors when cell is selected", () => {
    const cellItem: CellItem = {
      key,
      colorOverrides: {
        backColorSelected: 0xFF0000,
        foreColorSelected: 0xAA0000,
      },
    };

    const content = render(
      <TableCellContent
        cellItem={cellItem}
        isSelected={true}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    const innerElement = content.container.firstChild as HTMLElement;
    expect(innerElement).to.not.be.empty;

    expect(innerElement.style.backgroundColor).to.equal("rgb(255, 0, 0)");
    expect(innerElement.style.color).to.equal("rgb(170, 0, 0)");
  });

  it("renders no style when cell is selected, but selection colors are not overriden", () => {
    const cellItem: CellItem = { key, colorOverrides: {} };

    const content = render(
      <TableCellContent
        cellItem={cellItem}
        isSelected={true}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);

    const innerElement = content.container.firstChild as HTMLElement;
    expect(innerElement).to.not.be.empty;

    expect(innerElement.style.backgroundColor).to.be.empty;
    expect(innerElement.style.color).to.be.empty;
  });
});

describe("TableIconCellContent", () => {
  it("renders", () => {
    const content = render(<TableIconCellContent iconName="test-icon" />);

    expect(content.container.querySelector(".test-icon")).to.not.be.empty;
  });
});

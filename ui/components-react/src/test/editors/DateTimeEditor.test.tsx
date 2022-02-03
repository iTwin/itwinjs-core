/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import type { PrimitiveValue, PropertyDescription, PropertyValue} from "@itwin/appui-abstract";
import {
  AlternateDateFormats, PropertyRecord, PropertyValueFormat,
  SpecialKey, StandardTypeNames, TimeDisplay,
} from "@itwin/appui-abstract";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { EditorContainer /* PropertyUpdatedArgs */ } from "../../components-react/editors/EditorContainer";
import { DateTimeEditor } from "../../components-react/editors/DateTimeEditor";
import TestUtils, { MineDataController } from "../TestUtils";
import { PropertyEditorManager } from "../../components-react/editors/PropertyEditorManager";
import { findInstance } from "../ReactInstance";

function createDateProperty(propertyName: string, value: Date, option: number) {
  const v: PropertyValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value,
  };

  let typename = StandardTypeNames.DateTime;
  let converter: any;

  switch (option) {
    case 0:
      typename = StandardTypeNames.DateTime;
      break;
    case 1:
      typename = StandardTypeNames.ShortDate;
      break;
    case 2:
      typename = StandardTypeNames.DateTime;
      converter = { options: { timeDisplay: TimeDisplay.H24M } }; // DateTime with 24hr time
      break;
    case 3:
      typename = StandardTypeNames.DateTime;
      converter = { options: { timeDisplay: TimeDisplay.H24MS } }; // DateTime with 24hr time
      break;
    case 4:
      typename = StandardTypeNames.DateTime;
      converter = { options: { timeDisplay: TimeDisplay.H12MSC } }; // DateTime with 12hr time
      break;
    case 5:
      typename = StandardTypeNames.ShortDate;
      converter = { name: "mm-dd-yyyy" };
      break;
    case 6:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.IsoDateTime } };
      break;
    case 7:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.IsoShort } };
      break;
    case 8:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcShort } };
      break;
    case 9:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcShortWithDay } };
      break;
    case 10:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcDateTime } };
      break;
    case 11:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcDateTimeWithDay } };
      break;
    case 12:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.IsoDateTime } };
      break;
    case 13:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.IsoShort } };
      break;
    case 14:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcShort } };
      break;
    case 15:
      typename = StandardTypeNames.DateTime;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcShortWithDay } };
      break;
    case 16:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcDateTime } };
      break;
    case 17:
    default:
      typename = StandardTypeNames.ShortDate;
      converter = { options: { alternateDateFormat: AlternateDateFormats.UtcDateTimeWithDay } };
      break;
  }

  const pd: PropertyDescription = {
    typename, // ShortDate | DateTime
    converter,
    name: propertyName,
    displayLabel: propertyName,
  };
  return new PropertyRecord(v, pd);
}

describe("<DateTimeEditor />", () => {
  const date = new Date(2018, 0, 1);
  const jan4Ticks = new Date(2018, 0, 4).getTime();

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("long date should render", async () => {
    const spyOnCommit = sinon.spy();
    const record = createDateProperty("Test", date, 0);  // 0 creates a long DateTime record
    const renderedComponent = render(<DateTimeEditor showTime={true} propertyRecord={record} onCommit={spyOnCommit} />);
    expect(await waitFor(() => renderedComponent.getByText(date.toLocaleString()))).to.exist;
    const originalValue = (record.value as PrimitiveValue).value as Date;
    expect(originalValue.getTime()).to.be.equal(date.getTime());
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = await renderedComponent.findByTestId("components-popup-button");
    fireEvent.click(popupButton);
    const timeDiv = await renderedComponent.findByTestId("components-time-input");
    const hrInput = timeDiv.querySelector(".iui-input.components-time-input") as HTMLInputElement;
    expect(hrInput).not.to.be.null;
    hrInput.focus();
    fireEvent.change(hrInput, { target: { value: "09" } });
    hrInput.blur();
    //  renderedComponent.debug();
    const okButton = renderedComponent.getByTestId("components-popup-ok-button");
    fireEvent.click(okButton);
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit).to.be.calledOnce;
    fireEvent.click(popupButton);
  });

  it("long utc date should render", async () => {
    const spyOnCommit = sinon.spy();
    const record = createDateProperty("Test", date, 13);  // 13 creates a long utc DateTime record
    const renderedComponent = render(<DateTimeEditor showTime={true} propertyRecord={record} onCommit={spyOnCommit} />);
    const popupButton = await renderedComponent.findByTestId("components-popup-button");
    fireEvent.click(popupButton);
    const timeDiv = await renderedComponent.findByTestId("components-time-input");
    const hrInput = timeDiv.querySelector(".iui-input.components-time-input") as HTMLInputElement;
    expect(hrInput).not.to.be.null;
    hrInput.focus();
    fireEvent.change(hrInput, { target: { value: "09" } });
    hrInput.blur();
    //  renderedComponent.debug();
    const okButton = renderedComponent.getByTestId("components-popup-ok-button");
    fireEvent.click(okButton);
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit).to.be.calledOnce;
    fireEvent.click(popupButton);
  });

  it("short date should render", async () => {
    const record = createDateProperty("Test", date, 1);  // 1 creates a short DateTime record
    const { getByText, findByTestId } = render(<DateTimeEditor showTime={true} propertyRecord={record} />);
    await waitFor(() => expect(getByText(date.toLocaleDateString())).to.exist);
    const originalValue = (record.value as PrimitiveValue).value as Date;
    expect(originalValue.getTime()).to.be.equal(date.getTime());
    // expect(renderedComponent).not.to.be.undefined;
    const popupButton = await findByTestId("components-popup-button");
    fireEvent.click(popupButton);
    fireEvent.keyDown(popupButton, { key: SpecialKey.Enter });
  });

  it("all variations should render", async () => {
    let record = createDateProperty("Test", date, 0);
    const renderedComponent = render(<EditorContainer propertyRecord={record} title="date" onCommit={() => { }} onCancel={() => { }} />);

    for (let i = 1; i < 18; i++) {
      record = createDateProperty("Test", date, i);
      renderedComponent.rerender(<EditorContainer propertyRecord={record} title="date" onCommit={() => { }} onCancel={() => { }} />);
      const popupButton = renderedComponent.getByTestId("components-popup-button");
      expect(popupButton).not.to.be.undefined;
    }
  });

  it("renders editor for 'date' type", async () => {
    const spyOnCommit = sinon.spy();
    const record = createDateProperty("Test", date, 10);
    const renderedComponent = render(<EditorContainer propertyRecord={record} title="date" onCommit={spyOnCommit} onCancel={() => { }} />);
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = await renderedComponent.findByTestId("components-popup-button");
    fireEvent.click(popupButton);
    const portalDiv = await renderedComponent.findByTestId("core-popup");

    const dataValueSelector = `li[data-value='${jan4Ticks}']`; // Jan 4 2018 (UTC-0)
    const dayEntry = portalDiv.querySelector(dataValueSelector);
    expect(dayEntry).not.to.be.null;
    fireEvent.click(dayEntry!);

    const okButton = renderedComponent.getByTestId("components-popup-ok-button");
    fireEvent.click(okButton);
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit).to.be.calledOnce;
  });

  it("renders editor for 'date' type - cancel", async () => {
    const spyOnCommit = sinon.spy();
    const record1 = createDateProperty("Test", date, 0);
    const record2 = createDateProperty("Test", date, 10);

    const renderedComponent = render(<EditorContainer propertyRecord={record1} title="date" onCommit={spyOnCommit} onCancel={() => { }} />);
    renderedComponent.rerender(<EditorContainer propertyRecord={record2} title="date" onCommit={spyOnCommit} onCancel={() => { }} />);

    expect(renderedComponent).not.to.be.undefined;
    const popupButton = await renderedComponent.findByTestId("components-popup-button");
    fireEvent.click(popupButton);
    const portalDiv = await renderedComponent.findByTestId("core-popup");

    const dataValueSelector = `li[data-value='${jan4Ticks}']`; // Jan 4 2018 (UTC-0)
    const dayEntry = portalDiv.querySelector(dataValueSelector);
    expect(dayEntry).not.to.be.null;
    fireEvent.click(dayEntry!);

    const cancelButton = renderedComponent.getByTestId("components-popup-cancel-button");
    fireEvent.click(cancelButton);
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.notCalled);
  });

  it("should not commit if DataController fails to validate", async () => {
    PropertyEditorManager.registerDataController("myData", MineDataController);
    const propertyRecord = createDateProperty("Test", date, 10);
    propertyRecord.property.dataController = "myData";

    const spyOnCommit = sinon.spy();
    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={spyOnCommit} onCancel={() => { }} />);
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = await renderedComponent.findByTestId("components-popup-button");
    expect(popupButton).not.to.be.null;

    fireEvent.keyDown(popupButton, { key: SpecialKey.Enter });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.called).to.be.false;

    PropertyEditorManager.deregisterDataController("myData");
  });

  it("should receive focus", async () => {
    const record = createDateProperty("Test", date, 0);  // 0 creates a long DateTime record
    const renderedComponent = render(<DateTimeEditor showTime={true} propertyRecord={record} />);
    expect(await waitFor(() => renderedComponent.getByText(date.toLocaleString()))).to.exist;
    const popupButton = await renderedComponent.findByTestId("components-popup-button");
    expect(popupButton).not.to.be.null;
    popupButton.focus();
    const editor = findInstance(renderedComponent.container.firstChild);
    expect (editor).not.to.be.null;
    expect (editor.hasFocus).to.be.true;
  });
});

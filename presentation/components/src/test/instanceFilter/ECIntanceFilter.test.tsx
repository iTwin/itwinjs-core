/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClassInfo } from "@itwin/presentation-common";
import { act, fireEvent, render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { ECInstanceFilterBuilder } from "../../presentation-components";
import { stubRaf } from "./Common";

describe("ECInstanceFilter", () => {
  stubRaf();
  const classInfos: ClassInfo[] = [
    { id: "0x1",name: "Schema:Class1", label: "Class1" },
    { id: "0x2",name: "Schema:Class2", label: "Class2" },
  ];

  it("invokes 'onClassSelected' when non selected class is clicked", () => {
    const spy = sinon.spy();
    const {container, getByTestId} = render(<ECInstanceFilterBuilder
      classes={classInfos}
      selectedClasses={[]}
      properties={[]}
      onClassDeSelected={() => {}}
      onClassSelected={spy}
      onClearClasses={() => {}}
      onFilterChanged={() => {}}
    />);

    fireEvent.mouseDown(getByTestId("multi-tag-select-dropdownIndicator"));

    const option = container.querySelector(".iui-menu-item");
    expect(option).to.not.be.null;

    act(() => {fireEvent.click(option!);});
    expect(spy).to.be.calledOnceWith(classInfos[0]);
  });

  it("invokes 'onClassDeselected' when selected class is clicked", () => {
    const spy = sinon.spy();
    const {container, getByTestId} = render(<ECInstanceFilterBuilder
      classes={classInfos}
      selectedClasses={[classInfos[0]]}
      properties={[]}
      onClassDeSelected={spy}
      onClassSelected={() => {}}
      onClearClasses={() => {}}
      onFilterChanged={() => {}}
    />);

    fireEvent.mouseDown(getByTestId("multi-tag-select-dropdownIndicator"));

    const option = container.querySelector(".iui-menu-item");
    expect(option).to.not.be.null;

    fireEvent.click(option!);
    expect(spy).to.be.calledOnceWith(classInfos[0]);
  });

  it("invokes 'onClassDeselected' when remove tag button is clicked", () => {
    const spy = sinon.spy();
    const {container} = render(<ECInstanceFilterBuilder
      classes={classInfos}
      selectedClasses={[classInfos[0]]}
      properties={[]}
      onClassDeSelected={spy}
      onClassSelected={() => {}}
      onClearClasses={() => {}}
      onFilterChanged={() => {}}
    />);

    const removeTagButton = container.querySelector(".iui-tag .iui-button");
    expect(removeTagButton).to.not.be.null;

    fireEvent.click(removeTagButton!);
    expect(spy).to.be.calledOnceWith(classInfos[0]);
  });

  it("invokes 'onClearClasses' when clear indicator is clicked", () => {
    const spy = sinon.spy();
    const {getByTestId} = render(<ECInstanceFilterBuilder
      classes={classInfos}
      selectedClasses={[classInfos[0]]}
      properties={[]}
      onClassDeSelected={() => {}}
      onClassSelected={() => {}}
      onClearClasses={spy}
      onFilterChanged={() => {}}
    />);

    fireEvent.mouseDown(getByTestId("multi-tag-select-clearIndicator"));
    expect(spy).to.be.calledOnce;
  });
});

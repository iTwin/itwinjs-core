/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { UiComponents } from "@itwin/components-react";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ClassInfo } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render } from "@testing-library/react";
import { InstanceFilterBuilder } from "../../presentation-components/instance-filter-builder/InstanceFilterBuilder";
import { stubRaf } from "./Common";

describe("InstanceFilter", () => {
  stubRaf();
  const classInfos: ClassInfo[] = [
    { id: "0x1",name: "Schema:Class1", label: "Class1" },
    { id: "0x2",name: "Schema:Class2", label: "Class2" },
  ];

  before(async () => {
    await NoRenderApp.startup({
      localization: new EmptyLocalization(),
    });
    await UiComponents.initialize(new EmptyLocalization());
    await Presentation.initialize();
  });

  after(async () => {
    Presentation.terminate();
    UiComponents.terminate();
    await IModelApp.shutdown();
  });

  it("invokes 'onClassSelected' when non selected class is clicked", () => {
    const spy = sinon.spy();
    const {container, getByTestId} = render(<InstanceFilterBuilder
      classes={classInfos}
      selectedClasses={[]}
      properties={[]}
      onClassDeselected={() => {}}
      onClassSelected={spy}
      onClearClasses={() => {}}
      onFilterChanged={() => {}}
    />);

    fireEvent.mouseDown(getByTestId("multi-tag-select-dropdownIndicator"));

    const option = container.querySelector(".iui-menu-item");
    expect(option).to.not.be.null;

    fireEvent.click(option!);
    expect(spy).to.be.calledOnceWith(classInfos[0]);
  });

  it("invokes 'onClassDeselected' when selected class is clicked", () => {
    const spy = sinon.spy();
    const {container, getByTestId} = render(<InstanceFilterBuilder
      classes={classInfos}
      selectedClasses={[classInfos[0]]}
      properties={[]}
      onClassDeselected={spy}
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
    const {container} = render(<InstanceFilterBuilder
      classes={classInfos}
      selectedClasses={[classInfos[0]]}
      properties={[]}
      onClassDeselected={spy}
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
    const {getByTestId} = render(<InstanceFilterBuilder
      classes={classInfos}
      selectedClasses={[classInfos[0]]}
      properties={[]}
      onClassDeselected={() => {}}
      onClassSelected={() => {}}
      onClearClasses={spy}
      onFilterChanged={() => {}}
    />);

    fireEvent.mouseDown(getByTestId("multi-tag-select-clearIndicator"));
    expect(spy).to.be.calledOnce;
  });
});

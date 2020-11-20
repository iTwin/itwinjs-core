/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Icon } from "../../ui-core/icons/IconComponent";
import { Slider } from "../../ui-core/slider/Slider";
import TestUtils from "../TestUtils";

describe("Slider", () => {

  afterEach(cleanup);

  it("should render", () => {
    const component = render(<Slider min={0} max={100} values={[50]} />);
    expect(component.queryByTestId("core-slider-min")).to.not.exist;
    expect(component.queryByTestId("core-slider-max")).to.not.exist;
    expect(component.queryByTestId("core-slider-ticks")).to.not.exist;
    expect(component.container.querySelector(".core-disabled")).to.be.null;
  });

  it("should render with showMinMax", () => {
    const component = render(<Slider min={0} max={100} values={[50]} showMinMax={true} />);
    expect(component.getByTestId("core-slider-min")).to.exist;
    expect(component.getByTestId("core-slider-max")).to.exist;
  });

  it("should render with showMinMax & minImage/maxImage", () => {
    const component = render(<Slider min={0} max={100} values={[50]} showMinMax={true} minImage={<Icon iconSpec="icon-placeholder" />} maxImage={<Icon iconSpec="icon-placeholder" />} />);
    expect(component.container.querySelector(".icon-placeholder")).not.to.be.null;
  });

  it("should render with showTicks, showTickLabels & getTickCount", () => {
    const spyMethod = sinon.spy();
    const component = render(<Slider min={0} max={100} values={[50]} showTicks={true} getTickCount={() => { spyMethod(); return 10; }} />);
    expect(component.getByTestId("core-slider-ticks")).to.exist;
    spyMethod.calledOnce.should.true;
  });

  it("should render with showTicks & getTickValues", () => {
    const spyMethod = sinon.spy();
    const component = render(<Slider min={0} max={50} values={[20]} showTicks={true} getTickValues={() => { spyMethod(); return [0, 10, 20, 30, 40, 50]; }} />);
    expect(component.getByTestId("core-slider-ticks")).to.exist;
    spyMethod.calledOnce.should.true;
  });

  it("should render with showTicks & includeTicksInWidth", () => {
    const component = render(<Slider min={0} max={100} values={[50]} showTicks={true} getTickCount={() => 10} includeTicksInWidth={true} />);
    expect(component.container.querySelector(".core-slider-includeTicksInWidth")).not.to.be.null;
  });

  it("should render with showTicks & showTickLabels", () => {
    const component = render(<Slider min={0} max={100} values={[50]} showTicks={true} showTickLabels={true} getTickCount={() => 10} />);
    expect(component.queryByText("50")).not.to.be.null;
  });

  it("should render with showTicks, showTickLabels & formatTick", () => {
    const component = render(<Slider min={0} max={100} values={[50]} showTicks={true} showTickLabels={true} getTickCount={() => 10} formatTick={(value) => `*${value.toString()}*`} />);
    expect(component.queryByText("*50*")).not.to.be.null;
  });

  it("should render with disabled", () => {
    const component = render(<Slider min={0} max={100} values={[50]} showTicks={true} getTickCount={() => 10} showMinMax={true} disabled={true} />);
    expect(component.container.querySelector(".core-disabled")).not.to.be.null;
  });

  it("should render with multiple values", () => {
    const component = render(<Slider min={0} max={100} values={[30, 70]} />);
    expect(component.getAllByTestId("core-slider-handle").length).to.eq(2);
  });

  it("should render with multiple values & formatTooltip", () => {
    const component = render(<Slider min={0} max={100} values={[30, 70]} formatTooltip={(value) => `*${value.toString()}*`} />);
    expect(component.getAllByTestId("core-slider-handle").length).to.eq(2);
  });

  it("should render with showTooltip and tooltipBelow", () => {
    render(<Slider min={0} max={50} values={[0, 25]} showTooltip tooltipBelow />);
  });

  it("should render with decimal step", () => {
    render(<Slider min={0} max={5} values={[2.5]} step={0.25} showTooltip />);
  });

  it("should call onChange", async () => {
    const spyOnChange = sinon.spy();
    const component = render(<Slider min={0} max={100} values={[50]} onChange={spyOnChange} />);

    const handles = component.container.querySelectorAll(".core-slider-handle");
    expect(handles.length).to.eq(1);
    fireEvent.mouseDown(handles[0]);
    fireEvent.mouseUp(handles[0]);
    await TestUtils.flushAsyncOperations();
    expect(spyOnChange.calledOnce).to.be.true;
  });

  // it.only("should render with showTooltip", () => {
  //   const component = render(<Slider min={0} max={50} values={[0, 25]} showTooltip={true} />);
  //   const item = component.getByTestId("core-slider-track");
  //   item.dispatchEvent(TestUtils.createBubbledEvent("mouseenter"));
  //   expect(component.getByTestId("core-slider-tooltip")).to.exist;
  // });

});

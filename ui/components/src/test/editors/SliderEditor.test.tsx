/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount, shallow } from "enzyme";
import { cleanup, fireEvent, render, waitForElement } from "@testing-library/react";
import sinon from "sinon";
import * as React from "react";
import {
  BasePropertyEditorParams, PropertyEditorParamTypes, PropertyRecord, PropertyValue,
  SliderEditorParams, SpecialKey, StandardEditorNames,
} from "@bentley/ui-abstract";
import { SliderEditor } from "../../ui-components/editors/SliderEditor";
import TestUtils from "../TestUtils";
import { EditorContainer } from "../../ui-components/editors/EditorContainer";
import { AsyncValueProcessingResult, DataControllerBase, PropertyEditorManager } from "../../ui-components/editors/PropertyEditorManager";
import { OutputMessagePriority } from "@bentley/imodeljs-frontend";

describe("<SliderEditor />", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  it("should render", () => {
    const wrapper = mount(<SliderEditor />);
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(<SliderEditor />).should.matchSnapshot();
  });

  it("getValue returns proper value after componentDidMount & setState", async () => {
    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    const wrapper = mount(<SliderEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const editor = wrapper.instance() as SliderEditor;
    expect(editor.state.value).to.equal(50);

    wrapper.unmount();
  });

  it("componentDidUpdate updates the value", async () => {
    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    const wrapper = mount(<SliderEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const editor = wrapper.instance() as SliderEditor;
    expect(editor.state.value).to.equal(50);

    const testValue = 60;
    const newRecord = TestUtils.createNumericProperty("Test", testValue, StandardEditorNames.Slider);
    wrapper.setProps({ propertyRecord: newRecord });
    await TestUtils.flushAsyncOperations();
    expect(editor.state.value).to.equal(testValue);

    wrapper.unmount();
  });

  it("should support Slider Editor Params", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const formatTooltip = (_value: number): string => "";
    const formatTick = (tick: number): string => tick.toFixed(0);
    const getTickCount = (): number => 2; // 2 segments actually 3 ticks
    const getTickValues = (): number[] => [1, 100];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 1,
      maximum: 100,
      step: 5,
      mode: 1,
      reversed: true,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: true,
      maxIconSpec: "icon-placeholder",
      showTicks: true,
      showTickLabels: true,
      formatTooltip,
      formatTick,
      getTickCount,
      getTickValues,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const wrapper = mount(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const sliderEditor = wrapper.find(SliderEditor);
    expect(sliderEditor.length).to.eq(1);
    expect(sliderEditor.state("size")).to.eq(100);
    expect(sliderEditor.state("min")).to.eq(1);
    expect(sliderEditor.state("max")).to.eq(100);
    expect(sliderEditor.state("step")).to.eq(5);
    expect(sliderEditor.state("thumbMode")).to.eq("allow-crossing");
    expect(sliderEditor.state("trackDisplayMode")).to.eq("odd-segments");
    expect(sliderEditor.state("value")).to.eq(50);
    expect(sliderEditor.state("isDisabled")).to.eq(undefined);
    expect(sliderEditor.state("showTooltip")).to.be.true;
    expect(sliderEditor.state("formatTooltip")).to.eq(formatTooltip);
    expect(sliderEditor.state("tooltipBelow")).to.be.true;
    expect(sliderEditor.state("minLabel")).to.eq(undefined);
    expect(wrapper.find(".icon").length).to.eq(1);
    wrapper.unmount();
  });

  it("calls onCommit on OK button click", async () => {
    const spyOnCommit = sinon.spy();
    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    const wrapper = mount(<SliderEditor propertyRecord={record} onCommit={spyOnCommit} />);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const okButton = wrapper.find("button.components-popup-ok-button");
    expect(okButton.length).to.eq(1);
    okButton.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(spyOnCommit.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("calls onCancel on Cancel button click", async () => {
    const spyOnCancel = sinon.spy();
    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    const wrapper = mount(<SliderEditor propertyRecord={record} onCancel={spyOnCancel} />);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const cancelButton = wrapper.find("button.components-popup-cancel-button");
    expect(cancelButton.length).to.eq(1);
    cancelButton.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(spyOnCancel.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("calls onCommit on Enter key", async () => {
    const spyOnCommit = sinon.spy();
    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    const wrapper = mount(<SliderEditor propertyRecord={record} onCommit={spyOnCommit} />);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Enter" }));
    await TestUtils.flushAsyncOperations();

    expect(spyOnCommit.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("calls onCancel on Escape key", async () => {
    const spyOnCancel = sinon.spy();
    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    const wrapper = mount(<SliderEditor propertyRecord={record} onCancel={spyOnCancel} />);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Escape" }));
    await TestUtils.flushAsyncOperations();

    expect(spyOnCancel.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("renders editor for 'number' type and 'slider' editor using SliderEditor", () => {
    const propertyRecord = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    expect(renderedComponent.container.querySelector(".components-slider-editor")).to.not.be.empty;
    cleanup();
  });

  it("calls onCommit for Change", async () => {
    const propertyRecord = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    const spyOnCommit = sinon.spy();
    function handleCommit(): void {
      spyOnCommit();
    }
    const component = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);

    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();

    const sliderContainer = component.container.ownerDocument.querySelector(".iui-slider-container");
    expect(sliderContainer).to.exist;
    fireEvent.mouseDown(sliderContainer!);
    await TestUtils.flushAsyncOperations();

    const ok = component.getByTestId("components-popup-ok-button");
    expect(ok).to.exist;
    fireEvent.click(ok);
    await TestUtils.flushAsyncOperations();

    expect(spyOnCommit.calledOnce).to.be.true;
    cleanup();
  });

  it("should render Editor Params reversed track coloring", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 0,
      maximum: 100,
      step: 5,
      reversed: true,
      showTooltip: true,
      tooltipBelow: true,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    const track = component.container.ownerDocument.querySelector(".iui-slider-track");
    expect(track).to.exist;
    expect((track as HTMLElement).style.right).to.eq("0%");
    expect((track as HTMLElement).style.left).to.eq("50%");
    component.unmount();
    cleanup();
  });

  it("should render Editor Params reversed track coloring", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 0,
      maximum: 100,
      step: 5,
      reversed: false,
      showTooltip: true,
      tooltipBelow: true,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    const track = component.container.ownerDocument.querySelector(".iui-slider-track");
    expect(track).to.exist;
    expect((track as HTMLElement).style.left).to.eq("0%");
    expect((track as HTMLElement).style.right).to.eq("50%");
    component.unmount();
    cleanup();
  });

  it("should render Editor Params w/decimal step", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 0,
      maximum: 5,
      step: 1.5,
      mode: 1,
      showTooltip: true,
      showMinMax: false,
      maxIconSpec: "icon-placeholder",
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 3, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("3.0");
    component.unmount();
    cleanup();
  });

  it("should render Editor Params w/decimal step", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 0,
      maximum: 5,
      step: 1.5,
      mode: 1,
      showTooltip: true,
      showMinMax: false,
      maxIconSpec: "icon-placeholder",
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 3, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("3.0");
    component.unmount();
    cleanup();
  });

  it("should render Editor Params w/ticks no tick labels", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const formatTooltip = (value: number): string => value.toFixed(2);
    const formatTick = (value: number): string => value.toFixed(1);
    const getTickCount = (): number => 2; // 2 segment / 3 ticks 0-50-100
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 1,
      maximum: 100,
      step: 5,
      mode: 1,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: true,
      maxIconSpec: "icon-placeholder",
      showTicks: true,
      showTickLabels: false,
      getTickCount,
      formatTooltip,
      formatTick,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector("span.iui-slider-min")?.textContent).to.eq("1");
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("50.00");
    const maxLabel = component.container.ownerDocument.querySelector("span.iui-slider-max");
    expect(maxLabel?.querySelector(".icon-placeholder")).to.exist;
    const ticks = component.container.ownerDocument.querySelectorAll("span.iui-slider-tick");
    expect(ticks.length).to.eq(3);
    component.unmount();
    cleanup();
  });
  it("should render Editor Params w/ticks", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const formatTooltip = (value: number): string => value.toFixed(2);
    const formatTick = (value: number): string => value.toFixed(1);
    const getTickCount = (): number => 1;
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 1,
      maximum: 100,
      mode: 1,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: true,
      maxIconSpec: "icon-placeholder",
      showTicks: true,
      showTickLabels: true,
      getTickCount,
      formatTooltip,
      formatTick,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector("span.iui-slider-min")?.textContent).to.eq("1");
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("50.00");
    const maxLabel = component.container.ownerDocument.querySelector("span.iui-slider-max");
    expect(maxLabel?.querySelector(".icon-placeholder")).to.exist;
    const ticks = component.container.ownerDocument.querySelectorAll("span.iui-slider-tick");
    expect(ticks.length).to.eq(2);
    expect(ticks[0]?.textContent).to.eq("1.0");
    expect(ticks[1]?.textContent).to.eq("100.0");
    component.unmount();
    cleanup();
  });

  it("should render Editor Params w/defined ticks values", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const getTickValues = (): number[] => [0, 50, 100];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 0,
      maximum: 100,
      step: 5,
      mode: 1,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: true,
      showTicks: true,
      showTickLabels: true,
      getTickValues,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector("span.iui-slider-min")?.textContent).to.eq("0");
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("50");
    expect(component.container.ownerDocument.querySelector("span.iui-slider-max")?.textContent).to.eq("100");
    const ticks = component.container.ownerDocument.querySelectorAll("span.iui-slider-tick");
    expect(ticks.length).to.eq(3);
    expect(ticks[0]?.textContent).to.eq("0");
    expect(ticks[1]?.textContent).to.eq("50");
    expect(ticks[2]?.textContent).to.eq("100");

    component.unmount();
    cleanup();
  });

  it("should render Editor Params w/defined formatted ticks values", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const formatTick = (value: number): string => value.toFixed(1);
    const getTickValues = (): number[] => [0, 50, 100];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 0,
      maximum: 100,
      step: 5,
      mode: 1,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: true,
      showTicks: true,
      showTickLabels: true,
      getTickValues,
      formatTick,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector("span.iui-slider-min")?.textContent).to.eq("0");
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("50");
    expect(component.container.ownerDocument.querySelector("span.iui-slider-max")?.textContent).to.eq("100");
    const ticks = component.container.ownerDocument.querySelectorAll("span.iui-slider-tick");
    expect(ticks.length).to.eq(3);
    expect(ticks[0]?.textContent).to.eq("0.0");
    expect(ticks[1]?.textContent).to.eq("50.0");
    expect(ticks[2]?.textContent).to.eq("100.0");

    component.unmount();
    cleanup();
  });

  it("should render Editor Params w/ticks and default labels", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const getTickCount = (): number => 4;  // four segments
    // const getTickValues = (): number[] => [1, 100];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 0,
      maximum: 100,
      step: 5,
      mode: 1,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: true,
      showTicks: true,
      showTickLabels: true,
      getTickCount,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector("span.iui-slider-min")?.textContent).to.eq("0");
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("50");
    expect(component.container.ownerDocument.querySelector("span.iui-slider-max")?.textContent).to.eq("100");
    const ticks = component.container.ownerDocument.querySelectorAll("span.iui-slider-tick");
    expect(ticks.length).to.eq(5);
    expect(ticks[0]?.textContent).to.eq("0");
    expect(ticks[1]?.textContent).to.eq("25");
    expect(ticks[2]?.textContent).to.eq("50");
    expect(ticks[3]?.textContent).to.eq("75");
    expect(ticks[4]?.textContent).to.eq("100");

    component.unmount();
    cleanup();
  });

  it("should render Editor Params icon labels", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const formatTooltip = (value: number): string => value.toFixed(1);
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 1,
      maximum: 100,
      step: 5,
      mode: 1,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: true,
      maxIconSpec: "icon-placeholder",
      minIconSpec: "icon-placeholder",
      showTicks: true,
      showTickLabels: true,
      formatTooltip,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("50.0");
    expect(component.container.ownerDocument.querySelector("span.iui-slider-min")?.querySelector(".icon-placeholder")).to.exist;
    expect(component.container.ownerDocument.querySelector("span.iui-slider-max")?.querySelector(".icon-placeholder")).to.exist;
    component.unmount();
    cleanup();
  });

  it("should render Editor Params string labels", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 1,
      maximum: 100,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: true,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("50");
    expect(component.container.ownerDocument.querySelector("span.iui-slider-min")?.textContent).to.eq("1");
    expect(component.container.ownerDocument.querySelector("span.iui-slider-max")?.textContent).to.eq("100");
    component.unmount();
    cleanup();
  });

  it("should render Editor Params and trigger handleChange callback", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const sliderParams: SliderEditorParams = {
      type: PropertyEditorParamTypes.Slider,
      size: 100,
      minimum: 1,
      maximum: 100,
      step: 5,
      showTooltip: true,
      tooltipBelow: true,
      showMinMax: false,
      maxIconSpec: "icon-placeholder",
      showTicks: true,
      showTickLabels: true,
    };
    editorParams.push(sliderParams);

    const record = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider, editorParams);
    const component = render(<SliderEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();
    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();

    const thumb = component.container.ownerDocument.querySelector(".iui-slider-thumb");
    expect(thumb).to.exist;
    fireEvent.keyDown(thumb!, { key: SpecialKey.ArrowRight });
    await TestUtils.flushAsyncOperations();
    expect(component.container.ownerDocument.querySelector(".iui-tooltip")?.textContent).to.eq("55");

    component.unmount();
    cleanup();
  });

  class MineDataController extends DataControllerBase {
    public override async validateValue(_newValue: PropertyValue, _record: PropertyRecord): Promise<AsyncValueProcessingResult> {
      return { encounteredError: true, errorMessage: { priority: OutputMessagePriority.Error, briefMessage: "Test" } };
    }
  }

  it("should not commit if DataController fails to validate", async () => {
    PropertyEditorManager.registerDataController("myData", MineDataController);
    const propertyRecord = TestUtils.createNumericProperty("Test", 50, StandardEditorNames.Slider);
    propertyRecord.property.dataController = "myData";

    const spyOnCommit = sinon.spy();
    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={spyOnCommit} onCancel={() => { }} />);
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = await waitForElement(() => renderedComponent.getByTestId("components-popup-button"));
    expect(popupButton).not.to.be.null;

    fireEvent.keyDown(popupButton, { key: SpecialKey.Enter });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.called).to.be.false;

    PropertyEditorManager.deregisterDataController("myData");
  });

});

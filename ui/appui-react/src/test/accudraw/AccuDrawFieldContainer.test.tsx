/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { fireEvent, render } from "@testing-library/react";
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { ColorByName, ColorDef } from "@itwin/core-common";
import type { IModelAppOptions} from "@itwin/core-frontend";
import { CompassMode, IModelApp, ItemField, MockRender } from "@itwin/core-frontend";
import { SpecialKey } from "@itwin/appui-abstract";
import { Orientation } from "@itwin/core-react";
import TestUtils from "../TestUtils";
import { FrameworkAccuDraw } from "../../appui-react/accudraw/FrameworkAccuDraw";
import { AccuDrawFieldContainer } from "../../appui-react/accudraw/AccuDrawFieldContainer";
import { KeyboardShortcutManager } from "../../appui-react/keyboardshortcut/KeyboardShortcut";
import { FrameworkUiAdmin } from "../../appui-react/uiadmin/FrameworkUiAdmin";
import type { AccuDrawUiSettings } from "../../appui-react/accudraw/AccuDrawUiSettings";

// cspell:ignore uiadmin

function requestNextAnimation() { }

describe("AccuDrawFieldContainer", () => {
  const rnaDescriptorToRestore = Object.getOwnPropertyDescriptor(IModelApp, "requestNextAnimation")!;

  before(async () => {
    // Avoid requestAnimationFrame exception during test by temporarily replacing function that calls it.
    // Tried replacing window.requestAnimationFrame first but that did not work.
    Object.defineProperty(IModelApp, "requestNextAnimation", {
      get: () => requestNextAnimation,
    });

    await TestUtils.initializeUiFramework();

    const opts: IModelAppOptions = {};
    opts.accuDraw = new FrameworkAccuDraw();
    opts.uiAdmin = new FrameworkUiAdmin();
    await MockRender.App.startup(opts);
  });

  after(async () => {
    await MockRender.App.shutdown();

    Object.defineProperty(IModelApp, "requestNextAnimation", rnaDescriptorToRestore);

    TestUtils.terminateUiFramework();
  });

  it("should render Vertical", () => {
    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
  });

  it("should render Horizontal", () => {
    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    render(<AccuDrawFieldContainer orientation={Orientation.Horizontal} />);
  });

  it("should emit onAccuDrawSetFieldValueToUiEvent", () => {
    const spy = sinon.spy();
    const remove = FrameworkAccuDraw.onAccuDrawSetFieldValueToUiEvent.addListener(spy);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
    IModelApp.accuDraw.onFieldValueChange(ItemField.X_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.onFieldValueChange(ItemField.Y_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.onFieldValueChange(ItemField.Z_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.onFieldValueChange(ItemField.ANGLE_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.onFieldValueChange(ItemField.DIST_Item);
    spy.calledOnce.should.true;
    spy.resetHistory();
    remove();
  });

  it("should emit onAccuDrawSetFieldLockEvent", () => {
    const spy = sinon.spy();
    const remove = FrameworkAccuDraw.onAccuDrawSetFieldLockEvent.addListener(spy);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    IModelApp.accuDraw.setFieldLock(ItemField.X_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.setFieldLock(ItemField.Y_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.setFieldLock(ItemField.Z_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.setFieldLock(ItemField.ANGLE_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    IModelApp.accuDraw.setFieldLock(ItemField.DIST_Item, true);
    spy.calledOnce.should.true;
    spy.resetHistory();
    remove();
  });

  it("should emit onAccuDrawSetFieldFocusEvent", async () => {
    const spy = sinon.spy();
    const remove = FrameworkAccuDraw.onAccuDrawSetFieldFocusEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    expect(IModelApp.accuDraw.hasInputFocus).to.be.false;

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    await TestUtils.flushAsyncOperations();

    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
    spy.calledOnce.should.true;
    let input = wrapper.queryByTestId("uifw-accudraw-x");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    IModelApp.accuDraw.setFocusItem(ItemField.Y_Item);
    spy.calledOnce.should.true;
    input = wrapper.queryByTestId("uifw-accudraw-y");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    input = wrapper.queryByTestId("uifw-accudraw-z");
    expect(input).to.be.null;

    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
    await TestUtils.flushAsyncOperations();

    IModelApp.accuDraw.setFocusItem(ItemField.ANGLE_Item);
    spy.calledOnce.should.true;
    input = wrapper.queryByTestId("uifw-accudraw-angle");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    IModelApp.accuDraw.setFocusItem(ItemField.DIST_Item);
    spy.calledOnce.should.true;
    input = wrapper.queryByTestId("uifw-accudraw-distance");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    await TestUtils.flushAsyncOperations();
    expect(IModelApp.accuDraw.hasInputFocus).to.be.true;

    remove();
  });

  it("should emit onAccuDrawSetFieldFocusEvent and show Z field", async () => {
    const spy = sinon.spy();
    const remove = FrameworkAccuDraw.onAccuDrawSetFieldFocusEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} showZOverride={true} />);
    expect(IModelApp.accuDraw.hasInputFocus).to.be.false;

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    await TestUtils.flushAsyncOperations();

    IModelApp.accuDraw.setFocusItem(ItemField.Z_Item);
    spy.calledOnce.should.true;
    const input = wrapper.queryByTestId("uifw-accudraw-z");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;
    spy.resetHistory();

    await TestUtils.flushAsyncOperations();
    expect(IModelApp.accuDraw.hasInputFocus).to.be.true;

    remove();
  });

  it("should emit onAccuDrawGrabFieldFocusEvent", async () => {
    const spySet = sinon.spy();
    const removeSet = FrameworkAccuDraw.onAccuDrawSetFieldFocusEvent.addListener(spySet);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    expect(IModelApp.accuDraw.hasInputFocus).to.be.false;

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    await TestUtils.flushAsyncOperations();

    IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
    spySet.calledOnce.should.true;
    const input = wrapper.queryByTestId("uifw-accudraw-x");
    expect(input).not.to.be.null;
    expect(document.activeElement === input).to.be.true;

    KeyboardShortcutManager.setFocusToHome();
    expect(document.activeElement === input).to.be.false;

    const spyGrab = sinon.spy();
    const removeGrab = FrameworkAccuDraw.onAccuDrawGrabInputFocusEvent.addListener(spyGrab);
    IModelApp.accuDraw.grabInputFocus();
    spyGrab.calledOnce.should.true;
    expect(document.activeElement === input).to.be.true;

    removeSet();
    removeGrab();
  });

  it("should emit onAccuDrawSetModeEvent", () => {
    const spy = sinon.spy();
    const remove = FrameworkAccuDraw.onAccuDrawSetCompassModeEvent.addListener(spy);
    render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);
    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
    spy.calledOnce.should.true;
    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    spy.calledTwice.should.true;
    remove();
  });

  it("should call onValueChanged & setFieldValueFromUi", () => {
    const fakeTimers = sinon.useFakeTimers();
    const spy = sinon.spy();
    const remove = FrameworkAccuDraw.onAccuDrawSetFieldValueFromUiEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

    let input = wrapper.queryByTestId("uifw-accudraw-x");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.queryByTestId("uifw-accudraw-y");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.queryByTestId("uifw-accudraw-z");
    expect(input).to.be.null;

    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);

    input = wrapper.queryByTestId("uifw-accudraw-angle");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    input = wrapper.queryByTestId("uifw-accudraw-distance");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    remove();
    fakeTimers.restore();
  });

  it("should call onValueChanged & setFieldValueFromUi & show the Z field", () => {
    const fakeTimers = sinon.useFakeTimers();
    const spy = sinon.spy();
    const remove = FrameworkAccuDraw.onAccuDrawSetFieldValueFromUiEvent.addListener(spy);
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} showZOverride={true} />);

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

    const input = wrapper.queryByTestId("uifw-accudraw-z");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fakeTimers.tick(300);
    spy.calledOnce.should.true;
    spy.resetHistory();

    remove();
    fakeTimers.restore();
  });

  it("should set focus to home on Esc", () => {
    const spy = sinon.spy(KeyboardShortcutManager, "setFocusToHome");
    const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} />);

    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

    const input = wrapper.queryByTestId("uifw-accudraw-x");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: SpecialKey.Escape });
    spy.calledOnce.should.true;

    (KeyboardShortcutManager.setFocusToHome as any).restore();
  });

  describe("FrameworkAccuDraw.uiStateStorage", () => {
    const bgColorTest = ColorByName.red;
    const fgColorTest = ColorByName.black;
    const labelTest = "label-test";
    const iconTest = "icon-test";

    const fullSettings: AccuDrawUiSettings = {
      xStyle: { display: "inline" },
      yStyle: { display: "inline" },
      zStyle: { display: "inline" },
      angleStyle: { display: "inline" },
      distanceStyle: { display: "inline" },
      xBackgroundColor: ColorDef.create(bgColorTest),
      yBackgroundColor: ColorDef.create(bgColorTest),
      zBackgroundColor: ColorDef.create(bgColorTest),
      angleBackgroundColor: ColorDef.create(bgColorTest),
      distanceBackgroundColor: ColorDef.create(bgColorTest),
      xForegroundColor: ColorDef.create(fgColorTest),
      yForegroundColor: ColorDef.create(fgColorTest),
      zForegroundColor: ColorDef.create(fgColorTest),
      angleForegroundColor: ColorDef.create(fgColorTest),
      distanceForegroundColor: ColorDef.create(fgColorTest),
      xLabel: labelTest,
      yLabel: labelTest,
      zLabel: labelTest,
      angleLabel: labelTest,
      distanceLabel: labelTest,
      xIcon: iconTest,
      yIcon: iconTest,
      zIcon: iconTest,
      angleIcon: iconTest,
      distanceIcon: iconTest,
    };

    it("should support FrameworkAccuDraw.uiStateStorage- set after render", async () => {
      const emptySettings: AccuDrawUiSettings = {};

      const spy = sinon.spy();
      FrameworkAccuDraw.uiStateStorage = undefined;
      const remove = FrameworkAccuDraw.onAccuDrawUiSettingsChangedEvent.addListener(spy);
      const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} showZOverride={true} />);

      const settingsTest = (count: number) => {
        spy.calledOnce.should.true;

        let labelElements = wrapper.queryAllByLabelText(labelTest);
        expect(labelElements.length).to.eq(count);

        const inputElements = wrapper.container.querySelectorAll("input");
        expect(inputElements.length).to.eq(count);
        for (const inputElement of inputElements) {
          expect(inputElement.getAttribute("style")).to.eq("display: inline; background-color: rgb(255, 0, 0); color: rgb(0, 0, 0);");
        }

        const iElements = wrapper.container.querySelectorAll(`i.${iconTest}`);
        expect(iElements.length).to.eq(count);

        FrameworkAccuDraw.uiStateStorage = emptySettings;
        spy.calledTwice.should.true;
        labelElements = wrapper.queryAllByLabelText(labelTest);
        expect(labelElements.length).to.eq(0);

        FrameworkAccuDraw.uiStateStorage = undefined;
        spy.calledThrice.should.true;
        labelElements = wrapper.queryAllByLabelText(labelTest);
        expect(labelElements.length).to.eq(0);
      };

      IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
      expect(wrapper.queryAllByLabelText(labelTest).length).to.eq(0);
      FrameworkAccuDraw.uiStateStorage = fullSettings;
      await TestUtils.flushAsyncOperations();
      settingsTest(3);

      spy.resetHistory();

      IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
      expect(wrapper.queryAllByLabelText(labelTest).length).to.eq(0);
      FrameworkAccuDraw.uiStateStorage = fullSettings;
      await TestUtils.flushAsyncOperations();
      settingsTest(2);

      remove();
    });

    it("should support FrameworkAccuDraw.uiStateStorage - set before render", async () => {
      const spy = sinon.spy();
      FrameworkAccuDraw.uiStateStorage = fullSettings;
      const remove = FrameworkAccuDraw.onAccuDrawUiSettingsChangedEvent.addListener(spy);
      const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} showZOverride={true} />);

      const settingsTest = (count: number) => {
        const labelElements = wrapper.queryAllByLabelText(labelTest);
        expect(labelElements.length).to.eq(count);

        const inputElements = wrapper.container.querySelectorAll("input");
        expect(inputElements.length).to.eq(count);
        for (const inputElement of inputElements) {
          expect(inputElement.getAttribute("style")).to.eq("display: inline; background-color: rgb(255, 0, 0); color: rgb(0, 0, 0);");
        }

        const iElements = wrapper.container.querySelectorAll(`i.${iconTest}`);
        expect(iElements.length).to.eq(count);
      };

      IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
      await TestUtils.flushAsyncOperations();
      settingsTest(3);

      IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
      await TestUtils.flushAsyncOperations();
      settingsTest(2);

      remove();
    });

    it("should support FrameworkAccuDraw.uiStateStorage with various color combinations", async () => {
      const backgroundSettings: AccuDrawUiSettings = {
        xBackgroundColor: ColorDef.create(bgColorTest),
      };

      const foregroundSettings: AccuDrawUiSettings = {
        xForegroundColor: ColorDef.create(fgColorTest),
      };

      const bgStringSettings: AccuDrawUiSettings = {
        xBackgroundColor: "rgba(255, 0, 0, 0.5)",
      };

      const fgStringSettings: AccuDrawUiSettings = {
        xForegroundColor: "rgba(0, 0, 255, 0.5)",
      };

      const wrapper = render(<AccuDrawFieldContainer orientation={Orientation.Vertical} showZOverride={true} />);
      IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);

      FrameworkAccuDraw.uiStateStorage = backgroundSettings;
      await TestUtils.flushAsyncOperations();
      let input = wrapper.queryByTestId("uifw-accudraw-x");
      expect(input).not.to.be.null;
      expect(input!.getAttribute("style")).to.eq("background-color: rgb(255, 0, 0);");

      FrameworkAccuDraw.uiStateStorage = foregroundSettings;
      await TestUtils.flushAsyncOperations();
      input = wrapper.queryByTestId("uifw-accudraw-x");
      expect(input).not.to.be.null;
      expect(input!.getAttribute("style")).to.eq("color: rgb(0, 0, 0);");

      FrameworkAccuDraw.uiStateStorage = bgStringSettings;
      await TestUtils.flushAsyncOperations();
      input = wrapper.queryByTestId("uifw-accudraw-x");
      expect(input).not.to.be.null;
      expect(input!.getAttribute("style")).to.eq("background-color: rgba(255, 0, 0, 0.5);");

      FrameworkAccuDraw.uiStateStorage = fgStringSettings;
      await TestUtils.flushAsyncOperations();
      input = wrapper.queryByTestId("uifw-accudraw-x");
      expect(input).not.to.be.null;
      expect(input!.getAttribute("style")).to.eq("color: rgba(0, 0, 255, 0.5);");
    });

  });

});

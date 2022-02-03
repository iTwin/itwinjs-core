/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { expect } from "chai";
import type { IModelAppOptions} from "@itwin/core-frontend";
import { BeButtonEvent, CompassMode, CurrentState, IModelApp, ItemField, MockRender, RotationMode } from "@itwin/core-frontend";
import TestUtils, { storageMock } from "../TestUtils";
import { FrameworkAccuDraw } from "../../appui-react/accudraw/FrameworkAccuDraw";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import { FrameworkUiAdmin } from "../../appui-react/uiadmin/FrameworkUiAdmin";
import { UiFramework } from "../../appui-react/UiFramework";

// cspell:ignore dont uiadmin

describe("FrameworkAccuDraw localStorage Wrapper", () => {

  const localStorageToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  const localStorageMock = storageMock();

  before(async () => {
    Object.defineProperty(window, "localStorage", {
      get: () => localStorageMock,
    });
  });

  after(() => {
    Object.defineProperty(window, "localStorage", localStorageToRestore);
  });

  describe("FrameworkAccuDraw", () => {
    before(async () => {
      await TestUtils.initializeUiFramework();

      const opts: IModelAppOptions = {};
      opts.accuDraw = new FrameworkAccuDraw();
      opts.uiAdmin = new FrameworkUiAdmin();
      await MockRender.App.startup(opts);
    });

    after(async () => {
      await MockRender.App.shutdown();
      TestUtils.terminateUiFramework();
    });

    it("FrameworkAccuDraw.displayNotifications should set & return correctly", () => {
      FrameworkAccuDraw.displayNotifications = false;
      expect(FrameworkAccuDraw.displayNotifications).to.be.false;
      FrameworkAccuDraw.displayNotifications = true;
      expect(FrameworkAccuDraw.displayNotifications).to.be.true;
    });

    it("should call onCompassModeChange & emit onAccuDrawSetModeEvent & set conditionals", () => {
      FrameworkAccuDraw.displayNotifications = true;
      const spy = sinon.spy();
      const spyMessage = sinon.spy(IModelApp.notifications, "outputMessage");
      const remove = FrameworkAccuDraw.onAccuDrawSetCompassModeEvent.addListener(spy);

      IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
      FrameworkAccuDraw.isPolarModeConditional.refresh();
      expect(ConditionalBooleanValue.getValue(FrameworkAccuDraw.isPolarModeConditional)).to.be.true;
      spy.calledOnce.should.true;
      spyMessage.calledOnce.should.true;
      spyMessage.resetHistory();

      IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
      FrameworkAccuDraw.isRectangularModeConditional.refresh();
      expect(ConditionalBooleanValue.getValue(FrameworkAccuDraw.isRectangularModeConditional)).to.be.true;
      spy.calledTwice.should.true;
      spyMessage.calledOnce.should.true;
      spyMessage.resetHistory();

      FrameworkAccuDraw.displayNotifications = false;
      IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
      spyMessage.called.should.false;
      spyMessage.resetHistory();

      remove();
    });

    it("should call onFieldLockChange & emit onAccuDrawSetFieldLockEvent", () => {
      const spy = sinon.spy();
      const remove = FrameworkAccuDraw.onAccuDrawSetFieldLockEvent.addListener(spy);
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

    it("should set rotation & conditionals correctly & notify", () => {
      FrameworkAccuDraw.displayNotifications = true;
      const spyMessage = sinon.spy(IModelApp.notifications, "outputMessage");

      IModelApp.accuDraw.setRotationMode(RotationMode.Top);
      FrameworkAccuDraw.isTopRotationConditional.refresh();
      expect(ConditionalBooleanValue.getValue(FrameworkAccuDraw.isTopRotationConditional)).to.be.true;
      spyMessage.calledOnce.should.true;
      spyMessage.resetHistory();
      IModelApp.accuDraw.setRotationMode(RotationMode.Front);
      FrameworkAccuDraw.isFrontRotationConditional.refresh();
      expect(ConditionalBooleanValue.getValue(FrameworkAccuDraw.isFrontRotationConditional)).to.be.true;
      spyMessage.calledOnce.should.true;
      spyMessage.resetHistory();
      IModelApp.accuDraw.setRotationMode(RotationMode.Side);
      FrameworkAccuDraw.isSideRotationConditional.refresh();
      expect(ConditionalBooleanValue.getValue(FrameworkAccuDraw.isSideRotationConditional)).to.be.true;
      spyMessage.calledOnce.should.true;
      spyMessage.resetHistory();
      IModelApp.accuDraw.setRotationMode(RotationMode.View);
      FrameworkAccuDraw.isViewRotationConditional.refresh();
      expect(ConditionalBooleanValue.getValue(FrameworkAccuDraw.isViewRotationConditional)).to.be.true;
      spyMessage.calledOnce.should.true;
      spyMessage.resetHistory();
      IModelApp.accuDraw.setRotationMode(RotationMode.ACS);
      FrameworkAccuDraw.isACSRotationConditional.refresh();
      expect(ConditionalBooleanValue.getValue(FrameworkAccuDraw.isACSRotationConditional)).to.be.true;
      spyMessage.calledOnce.should.true;
      spyMessage.resetHistory();
      IModelApp.accuDraw.setRotationMode(RotationMode.Context);
      FrameworkAccuDraw.isContextRotationConditional.refresh();
      expect(ConditionalBooleanValue.getValue(FrameworkAccuDraw.isContextRotationConditional)).to.be.true;
      spyMessage.calledOnce.should.true;
      spyMessage.resetHistory();

      FrameworkAccuDraw.displayNotifications = false;
      IModelApp.accuDraw.setRotationMode(RotationMode.Top);
      spyMessage.calledOnce.should.false;
      spyMessage.resetHistory();
    });

    it("should call onFieldValueChange & emit onAccuDrawSetFieldValueToUiEvent", () => {
      const spy = sinon.spy();
      const remove = FrameworkAccuDraw.onAccuDrawSetFieldValueToUiEvent.addListener(spy);
      IModelApp.accuDraw.setValueByIndex(ItemField.X_Item, 1.0);
      IModelApp.accuDraw.onFieldValueChange(ItemField.X_Item);
      spy.calledOnce.should.true;
      remove();
    });

    it("should emit onAccuDrawSetFieldFocusEvent", () => {
      const spy = sinon.spy();
      const remove = FrameworkAccuDraw.onAccuDrawSetFieldFocusEvent.addListener(spy);
      IModelApp.accuDraw.setFocusItem(ItemField.X_Item);
      spy.calledOnce.should.true;
      remove();
    });

    it("should emit onAccuDrawGrabInputFocusEvent", () => {
      const spy = sinon.spy();
      const remove = FrameworkAccuDraw.onAccuDrawGrabInputFocusEvent.addListener(spy);
      IModelApp.accuDraw.grabInputFocus();
      spy.calledOnce.should.true;
      remove();
    });

    it("hasInputFocus should return false", () => {
      expect(IModelApp.accuDraw.hasInputFocus).to.be.false;
    });

    it("should emit onAccuDrawSetFieldValueToUiEvent & onAccuDrawSetFieldFocusEvent", () => {
      const spyValue = sinon.spy();
      const remove = FrameworkAccuDraw.onAccuDrawSetFieldValueToUiEvent.addListener(spyValue);
      const spyFocus = sinon.spy();
      const removeFocusSpy = FrameworkAccuDraw.onAccuDrawSetFieldFocusEvent.addListener(spyFocus);

      IModelApp.accuDraw.currentState = CurrentState.Deactivated;
      IModelApp.accuDraw.onMotion(new BeButtonEvent());
      spyValue.called.should.false;
      spyValue.resetHistory();

      IModelApp.accuDraw.currentState = CurrentState.Active;
      IModelApp.accuDraw.onMotion(new BeButtonEvent());
      spyValue.called.should.true;
      spyFocus.called.should.true;
      spyValue.resetHistory();
      spyFocus.resetHistory();

      IModelApp.accuDraw.dontMoveFocus = true;
      IModelApp.accuDraw.onMotion(new BeButtonEvent());
      spyValue.called.should.true;
      spyFocus.called.should.false;

      remove();
      removeFocusSpy();
    });

    it("should save/retrieve displayNotifications to/from user storage", async () => {
      FrameworkAccuDraw.displayNotifications = true;
      await TestUtils.flushAsyncOperations();
      expect(FrameworkAccuDraw.displayNotifications).to.be.true;
      FrameworkAccuDraw.displayNotifications = false;
      await TestUtils.flushAsyncOperations();
      expect(FrameworkAccuDraw.displayNotifications).to.be.false;

      const instance = new FrameworkAccuDraw();
      await instance.loadUserSettings(UiFramework.getUiStateStorage());
      await TestUtils.flushAsyncOperations();
      expect(FrameworkAccuDraw.displayNotifications).to.be.false;
    });
  });
});

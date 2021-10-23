/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { isNavigationKey, ItemKeyboardNavigator, Orientation } from "../../core-react";
import { SpecialKey } from "@itwin/appui-abstract";

describe("ItemKeyboardNavigator", () => {
  describe("properties", () => {
    it("itemCount property should be set properly", () => {
      const nav = new ItemKeyboardNavigator(() => { }, () => { });
      expect(nav.itemCount).to.eq(0);
      nav.itemCount = 100;
      expect(nav.itemCount).to.eq(100);
    });

    it("orientation property should be set properly", () => {
      const nav = new ItemKeyboardNavigator(() => { }, () => { });
      expect(nav.orientation).to.eq(Orientation.Horizontal);
      nav.orientation = Orientation.Vertical;
      expect(nav.orientation).to.eq(Orientation.Vertical);
    });

    it("allowWrap property should be set properly", () => {
      const nav = new ItemKeyboardNavigator(() => { }, () => { });
      expect(nav.allowWrap).to.eq(true);
      nav.allowWrap = false;
      expect(nav.allowWrap).to.eq(false);
    });

    it("crossAxisArrowKeyHandler property should be set properly", () => {
      const nav = new ItemKeyboardNavigator(() => { }, () => { });
      expect(nav.crossAxisArrowKeyHandler).to.be.undefined;
      const callback = () => { };
      nav.crossAxisArrowKeyHandler = callback;
      expect(nav.crossAxisArrowKeyHandler).to.eq(callback);
    });
  });

  describe("events", () => {
    const keyEventMock = moq.Mock.ofType<React.KeyboardEvent>();

    beforeEach(() => {
      keyEventMock.reset();

      keyEventMock.setup((x) => x.shiftKey).returns(() => false);
      keyEventMock.setup((x) => x.ctrlKey).returns(() => false);
    });

    it("should call crossAxisArrowKeyHandler with true for ArrowRight", () => {
      const nav = new ItemKeyboardNavigator(() => { }, () => { });
      nav.orientation = Orientation.Vertical;
      const spy = sinon.spy();
      nav.crossAxisArrowKeyHandler = spy;
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowRight);
      nav.handleKeyDownEvent(keyEventMock.object, 0);
      nav.handleKeyUpEvent(keyEventMock.object, 0);
      expect(spy).to.be.calledWith(true);
    });

    it("should call crossAxisArrowKeyHandler with false for ArrowLeft", () => {
      const nav = new ItemKeyboardNavigator(() => { }, () => { });
      nav.orientation = Orientation.Vertical;
      const spy = sinon.spy();
      nav.crossAxisArrowKeyHandler = spy;
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowLeft);
      nav.handleKeyDownEvent(keyEventMock.object, 0);
      nav.handleKeyUpEvent(keyEventMock.object, 0);
      expect(spy).to.be.calledWith(false);
    });

    it("should call crossAxisArrowKeyHandler with true for ArrowDown", () => {
      const nav = new ItemKeyboardNavigator(() => { }, () => { });
      nav.orientation = Orientation.Horizontal;
      const spy = sinon.spy();
      nav.crossAxisArrowKeyHandler = spy;
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowDown);
      nav.handleKeyDownEvent(keyEventMock.object, 0);
      nav.handleKeyUpEvent(keyEventMock.object, 0);
      expect(spy).to.be.calledWith(true);
    });

    it("should call crossAxisArrowKeyHandler with false for ArrowUp", () => {
      const nav = new ItemKeyboardNavigator(() => { }, () => { });
      nav.orientation = Orientation.Horizontal;
      const spy = sinon.spy();
      nav.crossAxisArrowKeyHandler = spy;
      keyEventMock.setup((x) => x.key).returns(() => SpecialKey.ArrowUp);
      nav.handleKeyDownEvent(keyEventMock.object, 0);
      nav.handleKeyUpEvent(keyEventMock.object, 0);
      expect(spy).to.be.calledWith(false);
    });

  });

  describe("isNavigationKey", () => {
    it("should return true if arrow key", () => {
      isNavigationKey(SpecialKey.ArrowUp).should.true;
    });

    it("should return true if Home key", () => {
      isNavigationKey(SpecialKey.Home).should.true;
    });

    it("should return true if End key", () => {
      isNavigationKey(SpecialKey.End).should.true;
    });

    it("should return true if Enter key", () => {
      isNavigationKey(SpecialKey.Enter).should.true;
    });

    it("should return true if Space key", () => {
      isNavigationKey(SpecialKey.Space).should.true;
    });

    it("should return false if Delete key", () => {
      isNavigationKey(SpecialKey.Delete).should.false;
    });
  });

});

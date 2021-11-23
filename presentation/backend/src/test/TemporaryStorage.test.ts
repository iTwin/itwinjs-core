/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as lolex from "lolex";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { using } from "@itwin/core-bentley";
import { TemporaryStorage } from "../presentation-backend/TemporaryStorage";

describe("TemporaryStorage", () => {

  let clock: lolex.Clock;
  beforeEach(() => {
    clock = lolex.install();
  });
  afterEach(() => {
    clock.uninstall();
  });

  describe("constructor", () => {

    it("doesn't set up timer callback when interval is not set", () => {
      const s = sinon.spy(clock, "setInterval");
      using(new TemporaryStorage<string>({ factory: () => "" }), (_r) => {
        expect(s).to.not.be.called;
      });
    });

    it("doesn't set up timer callback when interval is set to 0", () => {
      const s = sinon.spy(clock, "setInterval");
      using(new TemporaryStorage<string>({ factory: () => "", cleanupInterval: 0 }), (_r) => {
        expect(s).to.not.be.called;
      });
    });

    it("sets up timer callback when interval is set to more than 0", () => {
      const s = sinon.spy(clock, "setInterval");
      using(new TemporaryStorage<string>({ factory: () => "", cleanupInterval: 1 }), (_r) => {
        expect(s).to.be.calledOnce;
      });
    });

  });

  describe("dispose", () => {

    it("stops automatic cleanup when cleanup interval is set", () => {
      const s = sinon.spy(clock, "clearInterval");
      const storage = new TemporaryStorage<string>({ factory: () => "", cleanupInterval: 1 });
      storage.dispose();
      expect(s).to.be.calledOnce;
    });

    it("calls cleanup handler for every value", () => {
      const cleanupHandlerMock = moq.Mock.ofType<(value: string) => void>();
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
        cleanupHandler: cleanupHandlerMock.object,
      });

      const values = ["a", "b", "c"];
      values.forEach((v) => storage.getValue(v));

      storage.dispose();

      cleanupHandlerMock.verify((x) => x(moq.It.isAnyString()), moq.Times.exactly(values.length));
      values.forEach((v) => cleanupHandlerMock.verify((x) => x(v), moq.Times.once()));
    });

    it("calls `onDisposedAll` callback", () => {
      const spy = sinon.spy();
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
        onDisposedAll: spy,
      });

      const values = ["a", "b", "c"];
      values.forEach((v) => storage.getValue(v));

      storage.dispose();

      expect(spy).to.be.calledOnce;
    });

  });

  describe("getValue", () => {

    it("creates value if not exists", () => {
      const factoryMock = moq.Mock.ofType<(id: string) => string>();
      factoryMock.setup((x) => x(moq.It.isAnyString())).returns((id: string) => id);
      const onCreatedSpy = sinon.spy();
      const storage = new TemporaryStorage<string>({
        factory: factoryMock.object,
        onCreated: onCreatedSpy,
      });

      const value = storage.getValue("a");
      expect(value).to.eq("a");
      factoryMock.verify((x) => x("a"), moq.Times.once());
      expect(onCreatedSpy).to.be.calledOnceWith("a");
    });

    it("doesn't create value if already exists", () => {
      const factoryMock = moq.Mock.ofType<(id: string) => string>();
      factoryMock.setup((x) => x(moq.It.isAnyString())).returns((id: string) => id);
      const onCreatedSpy = sinon.spy();
      const storage = new TemporaryStorage<string>({
        factory: factoryMock.object,
        onCreated: onCreatedSpy,
      });

      const value1 = storage.getValue("a");
      expect(value1).to.eq("a");
      expect(onCreatedSpy).to.be.calledOnceWith("a");
      onCreatedSpy.resetHistory();

      const value2 = storage.getValue("a");
      expect(value2).to.eq("a");
      expect(onCreatedSpy).to.not.be.called;

      factoryMock.verify((x) => x("a"), moq.Times.once());
    });

    it("does not dispose value if 'onValueUsed' was called", () => {
      const spy = sinon.spy();
      let valueUsed = () => { };
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
        onCreated: (_id: string, value: string, onValueUsed: () => void) => {
          if (value === "a")
            valueUsed = onValueUsed;
        },
        onDisposedSingle: spy,
        valueLifetime: 2,
      });

      storage.getValue("a");
      storage.getValue("b");
      // advance clock and verify values are still there
      clock.tick(1);
      expect(storage.values.length).to.eq(2);
      valueUsed();

      // advance clock and verify one value is still there
      clock.tick(2);
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(1);
      expect(spy).to.be.calledOnce;
      expect(spy).to.be.calledWith("b");
    });

  });

  describe("disposeOutdatedValues", () => {

    it("disposes value immediately if lifetime is unspecified", () => {
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
      });
      storage.getValue("a");
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(0);
    });

    it("disposes value immediately if lifetime is 0", () => {
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
        valueLifetime: 0,
      });
      storage.getValue("a");
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(0);
    });

    it("disposes value which is unused for longer than specified lifetime", () => {
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
        valueLifetime: 1,
      });
      storage.getValue("a");
      // advance clock and verify the value is still there
      clock.tick(1);
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(1);
      // advance clock and verify the value gets removed
      clock.tick(1);
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(0);
    });

    it("disposes only values which are unused for longer than specified lifetime", () => {
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
        valueLifetime: 1,
      });
      storage.getValue("a");
      clock.tick(1);
      storage.getValue("b");
      clock.tick(1);
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(1);
      expect(storage.values[0]).to.eq("b");
    });

    it("calls cleanup handler for disposed values", () => {
      const cleanupHandlerMock = moq.Mock.ofType<(value: string) => void>();
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
        cleanupHandler: cleanupHandlerMock.object,
      });
      storage.getValue("a");
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(0);
      cleanupHandlerMock.verify((x) => x("a"), moq.Times.once());
    });

    it("calls `onDisposedSingle` for disposed values", () => {
      const spy = sinon.spy();
      const storage = new TemporaryStorage<string>({
        factory: (id: string) => id,
        onDisposedSingle: spy,
      });
      storage.getValue("a");
      storage.getValue("b");
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(0);
      expect(spy).to.be.calledTwice;
      expect(spy).to.be.calledWith("a");
      expect(spy).to.be.calledWith("b");
    });

  });

});

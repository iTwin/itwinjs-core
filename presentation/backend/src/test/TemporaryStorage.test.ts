/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fakeTimers from "@sinonjs/fake-timers";
import * as sinon from "sinon";
import { using } from "@itwin/core-bentley";
import { PresentationError } from "@itwin/presentation-common";
import { FactoryBasedTemporaryStorage, FactoryBasedTemporaryStorageProps, TemporaryStorage } from "../presentation-backend/TemporaryStorage";

describe("TemporaryStorage", () => {

  let clock: fakeTimers.InstalledClock;
  beforeEach(() => {
    clock = fakeTimers.install();
  });
  afterEach(() => {
    clock.uninstall();
  });

  describe("constructor", () => {

    it("doesn't set up timer callback when interval is not set", () => {
      const s = sinon.spy(clock, "setInterval");
      using(new TemporaryStorage<string>({}), (_r) => {
        expect(s).to.not.be.called;
      });
    });

    it("doesn't set up timer callback when interval is set to 0", () => {
      const s = sinon.spy(clock, "setInterval");
      using(new TemporaryStorage<string>({ cleanupInterval: 0 }), (_r) => {
        expect(s).to.not.be.called;
      });
    });

    it("sets up timer callback when interval is set to more than 0", () => {
      const s = sinon.spy(clock, "setInterval");
      using(new TemporaryStorage<string>({ cleanupInterval: 1 }), (_r) => {
        expect(s).to.be.calledOnce;
      });
    });

  });

  describe("dispose", () => {

    it("stops automatic cleanup when cleanup interval is set", () => {
      const s = sinon.spy(clock, "clearInterval");
      const storage = new TemporaryStorage<string>({ cleanupInterval: 1 });
      storage.dispose();
      expect(s).to.be.calledOnce;
    });

    it("calls cleanup handler for every value", () => {
      const cleanupHandler = sinon.spy();
      const storage = new TemporaryStorage<string>({
        cleanupHandler,
      });

      const values = ["a", "b", "c"];
      values.forEach((v) => storage.addValue(v, v));

      storage.dispose();

      expect(cleanupHandler.callCount).to.eq(values.length);
      expect(cleanupHandler.getCall(0)).to.be.calledWithExactly("a", "a", "dispose");
      expect(cleanupHandler.getCall(1)).to.be.calledWithExactly("b", "b", "dispose");
      expect(cleanupHandler.getCall(2)).to.be.calledWithExactly("c", "c", "dispose");
    });

    it("calls `onDisposedAll` callback", () => {
      const spy = sinon.spy();
      const storage = new TemporaryStorage<string>({
        onDisposedAll: spy,
      });

      const values = ["a", "b", "c"];
      values.forEach((v) => storage.addValue(v, v));

      storage.dispose();

      expect(spy).to.be.calledOnce;
    });

  });

  describe("addValue", () => {

    let storage: TemporaryStorage<string>;
    beforeEach(() => {
      storage = new TemporaryStorage<string>({});
    });
    afterEach(() => {
      storage.dispose();
    });

    it("adds a new value", () => {
      storage.addValue("a", "A");
      expect(storage.values).to.deep.eq(["A"]);
    });

    it("throws when adding a value with existing id", () => {
      storage.addValue("a", "A");
      expect(() => storage.addValue("a", "X")).to.throw(PresentationError);
      expect(storage.values).to.deep.eq(["A"]);
    });

  });

  describe("getValue", () => {

    it("returns undefined if value does not exist", () => {
      const storage = new TemporaryStorage<string>({});
      const value = storage.getValue("a");
      expect(value).to.be.undefined;
    });

    it("returns value if exists", () => {
      const storage = new TemporaryStorage<string>({});
      storage.addValue("a", "A");
      const value = storage.getValue("a");
      expect(value).to.eq("A");
    });

  });

  describe("deleteValue", () => {

    it("calls cleanup handler", () => {
      const cleanupHandler = sinon.spy();
      const storage = new TemporaryStorage<string>({
        cleanupHandler,
      });
      storage.addValue("a", "A");
      storage.deleteValue("a");
      expect(cleanupHandler).to.be.calledOnceWithExactly("a", "A", "request");
    });

  });

  describe("disposeOutdatedValues", () => {

    it("doesn't dispose value if neither `unusedValueLifetime` nor `maxValueLifetime` are specified", () => {
      const storage = new TemporaryStorage<string>({});
      storage.addValue("a", "A");
      expect(storage.values.length).to.eq(1);
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(1);
    });

    describe("disposing based on `unusedValueLifetime`", () => {

      it("disposes value immediately if `unusedValueLifetime` is 0", () => {
        const storage = new TemporaryStorage<string>({
          unusedValueLifetime: 0,
        });
        storage.addValue("a", "A");
        expect(storage.values.length).to.eq(1);
        storage.disposeOutdatedValues();
        expect(storage.values.length).to.eq(0);
      });

      it("disposes value which is unused for longer than specified `unusedValueLifetime`", () => {
        const storage = new TemporaryStorage<string>({
          unusedValueLifetime: 1,
        });
        storage.addValue("a", "A");
        expect(storage.values.length).to.eq(1);
        // advance clock and verify the value is still there
        clock.tick(1);
        storage.disposeOutdatedValues();
        expect(storage.values.length).to.eq(1);
        // advance clock and verify the value gets removed
        clock.tick(1);
        storage.disposeOutdatedValues();
        expect(storage.values.length).to.eq(0);
      });

      it("disposes only values which are unused for longer than specified `unusedValueLifetime`", () => {
        const storage = new TemporaryStorage<string>({
          unusedValueLifetime: 1,
        });
        storage.addValue("a", "A");
        clock.tick(1);
        storage.addValue("b", "B");
        clock.tick(1);
        expect(storage.values.length).to.eq(2);
        storage.disposeOutdatedValues();
        expect(storage.values.length).to.eq(1);
        expect(storage.values[0]).to.eq("B");
      });

      it("doesn't dispose value if `notifyValueUsed` was called", () => {
        const storage = new TemporaryStorage<string>({
          unusedValueLifetime: 1,
        });
        storage.addValue("a", "A");
        storage.addValue("b", "B");
        expect(storage.values.length).to.eq(2);

        // advance clock and verify values are still there
        clock.tick(1);
        expect(storage.values.length).to.eq(2);

        storage.notifyValueUsed("b");

        // advance clock and verify only one value is still there
        clock.tick(1);
        storage.disposeOutdatedValues();
        expect(storage.values).to.deep.eq(["B"]);
      });

    });

    describe("disposing based on `maxValueLifetime`", () => {

      it("disposes value immediately if `maxValueLifetime` is 0", () => {
        const storage = new TemporaryStorage<string>({
          maxValueLifetime: 0,
        });
        storage.addValue("a", "A");
        expect(storage.values.length).to.eq(1);
        storage.disposeOutdatedValues();
        expect(storage.values.length).to.eq(0);
      });

      it("disposes value which was created for longer than specified `maxValueLifetime`", () => {
        const storage = new TemporaryStorage<string>({
          maxValueLifetime: 1,
        });
        storage.addValue("a", "A");
        expect(storage.values.length).to.eq(1);
        // advance clock and verify the value is still there
        clock.tick(1);
        storage.disposeOutdatedValues();
        expect(storage.values.length).to.eq(1);
        // advance clock and verify the value gets removed
        clock.tick(1);
        storage.disposeOutdatedValues();
        expect(storage.values.length).to.eq(0);
      });

      it("disposes only values which were created for longer than specified `maxValueLifetime`", () => {
        const storage = new TemporaryStorage<string>({
          maxValueLifetime: 1,
        });
        storage.addValue("a", "A");
        clock.tick(1);
        storage.addValue("b", "B");
        clock.tick(1);
        expect(storage.values.length).to.eq(2);
        storage.disposeOutdatedValues();
        expect(storage.values.length).to.eq(1);
        expect(storage.values[0]).to.eq("B");
      });

    });

    it("calls cleanup handler for disposed values", () => {
      const cleanupHandler = sinon.spy();
      const storage = new TemporaryStorage<string>({
        maxValueLifetime: 0,
        cleanupHandler,
      });
      storage.addValue("a", "A");
      expect(storage.values.length).to.eq(1);
      storage.disposeOutdatedValues();
      expect(storage.values.length).to.eq(0);
      expect(cleanupHandler).to.be.calledOnceWith("a", "A", "timeout");
    });

    it("calls `onDisposedSingle` for disposed values", () => {
      const spy = sinon.spy();
      const storage = new TemporaryStorage<string>({
        maxValueLifetime: 0,
        onDisposedSingle: spy,
      });
      storage.addValue("a", "A");
      storage.addValue("b", "B");
      expect(storage.values.length).to.eq(2);

      storage.disposeOutdatedValues();

      expect(storage.values.length).to.eq(0);
      expect(spy).to.be.calledTwice;
      expect(spy.firstCall).to.be.calledWith("a");
      expect(spy.secondCall).to.be.calledWith("b");
    });

  });

});

describe("FactoryBasedTemporaryStorage", () => {

  describe("getValue", () => {

    it("creates value if not exists", () => {
      const factory = sinon.fake((id: string) => id);
      const storage = new FactoryBasedTemporaryStorage<string>({
        factory,
      });

      const value = storage.getValue("a");
      expect(value).to.eq("a");
      expect(factory).to.be.calledOnceWith("a", sinon.match((arg) => typeof arg === "function"));
    });

    it("doesn't create value if already exists", () => {
      const factory = sinon.fake((id: string) => id);
      const storage = new FactoryBasedTemporaryStorage<string>({
        factory,
      });

      const value1 = storage.getValue("a");
      expect(value1).to.eq("a");
      expect(factory).to.be.calledOnceWith("a", sinon.match((arg) => typeof arg === "function"));
      factory.resetHistory();

      const value2 = storage.getValue("a");
      expect(value2).to.eq("a");
      expect(factory).to.not.be.called;
    });

    it("provides a function to update last used timestamp when calling factory", () => {
      const factory = sinon.fake<Parameters<FactoryBasedTemporaryStorageProps<string>["factory"]>, string>((id: string) => id);
      const storage = new FactoryBasedTemporaryStorage<string>({
        factory,
      });
      storage.getValue("a");
      const lastUsedTimestampUpdateHandler = factory.args[0][1];
      expect(lastUsedTimestampUpdateHandler).to.be.a("function");

      const updateSpy = sinon.spy(storage, "notifyValueUsed");
      lastUsedTimestampUpdateHandler();
      expect(updateSpy).to.be.calledOnceWith("a");
    });

  });

});

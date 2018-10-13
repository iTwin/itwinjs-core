/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, spy } from "chai";
import * as lolex from "lolex";
import * as moq from "@bentley/presentation-common/tests/_helpers/Mocks";
import { using } from "@bentley/bentleyjs-core";
import TemporaryStorage from "../lib/TemporaryStorage";

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
      const s = spy.on(clock, clock.setInterval.name);
      using(new TemporaryStorage<string>({ factory: () => "" }), () => {
        expect(s).to.not.be.called;
      });
    });

    it("doesn't set up timer callback when interval is set to 0", () => {
      const s = spy.on(clock, clock.setInterval.name);
      using(new TemporaryStorage<string>({ factory: () => "", cleanupInterval: 0 }), () => {
        expect(s).to.not.be.called;
      });
    });

    it("sets up timer callback when interval is set to more than 0", () => {
      const s = spy.on(clock, clock.setInterval.name);
      using(new TemporaryStorage<string>({ factory: () => "", cleanupInterval: 1 }), () => {
        expect(s).to.be.called.once;
      });
    });

  });

  describe("dispose", () => {

    it("stops automatic cleanup when cleanup interval is set", () => {
      const s = spy.on(clock, clock.clearInterval.name);
      const storage = new TemporaryStorage<string>({ factory: () => "", cleanupInterval: 1 });
      storage.dispose();
      expect(s).to.be.called.once;
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

  });

  describe("getValue", () => {

    it("creates value if not exists", () => {
      const factoryMock = moq.Mock.ofType<(id: string) => string>();
      factoryMock.setup((x) => x(moq.It.isAnyString())).returns((id: string) => id);
      const storage = new TemporaryStorage<string>({
        factory: factoryMock.object,
      });
      const value = storage.getValue("a");
      expect(value).to.eq("a");
      factoryMock.verify((x) => x("a"), moq.Times.once());
    });

    it("doesn't create value if already exists", () => {
      const factoryMock = moq.Mock.ofType<(id: string) => string>();
      factoryMock.setup((x) => x(moq.It.isAnyString())).returns((id: string) => id);
      const storage = new TemporaryStorage<string>({
        factory: factoryMock.object,
      });
      const value1 = storage.getValue("a");
      expect(value1).to.eq("a");
      const value2 = storage.getValue("a");
      expect(value2).to.eq("a");
      factoryMock.verify((x) => x("a"), moq.Times.once());
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

  });

});

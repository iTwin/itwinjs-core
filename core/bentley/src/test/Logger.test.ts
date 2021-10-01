/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BentleyError, LoggingMetaData } from "../BentleyError";
import { using } from "../Disposable";
import { Logger, LogLevel, PerfLogger } from "../Logger";
import { BeDuration } from "../Time";

let outerr: any[];
let outwarn: any[];
let outinfo: any[];
let outtrace: any[];

/* eslint-disable no-template-curly-in-string, @typescript-eslint/naming-convention */

function callLoggerConfigLevels(cfg: any, expectRejection: boolean) {
  try {
    Logger.configureLevels(cfg);
    assert.isFalse(expectRejection, "should have rejected config as invalid");
  } catch (err) {
    assert.isTrue(expectRejection, "should not have rejected config as invalid");
  }
}

function checkOutlet(outlet: any[], expected: any[] | undefined) {
  if (outlet.length === 0) {
    assert.isTrue(expected === undefined || expected.length === 0);
    return;
  }

  assert.isTrue(expected !== undefined);
  if (expected === undefined)
    return;
  assert.isArray(expected);

  assert.deepEqual(outlet.slice(0, 2), expected.slice(0, 2));

  if (expected.length === 3) {
    assert.isTrue(outlet.length === 3, "message is expected to have metaData");
    if (outlet.length === 3) {
      if (expected[2] === undefined)
        assert.isUndefined(outlet[2], "did not expect message to have a metaData function");
    } else {
      assert.isTrue(expected[2] !== undefined, "expected a metaData function");
      assert.deepEqual(outlet[2](), expected[2]());
    }
  } else {
    assert.isTrue(outlet.length === 2 || outlet[2] === undefined, "message is not expected to have metaData");
  }
}

function checkOutlets(e: any[] | undefined, w: any[] | undefined, i: any[] | undefined, t: any[] | undefined) {
  checkOutlet(outerr, e);
  checkOutlet(outwarn, w);
  checkOutlet(outinfo, i);
  checkOutlet(outtrace, t);
  clearOutlets();
}

function clearOutlets() {
  outerr = [];
  outwarn = [];
  outinfo = [];
  outtrace = [];
}

type FunctionReturningAny = () => any;

describe("Logger", () => {

  it("log without initializing", () => {
    // logging messages in the components must not cause failures if the app hasn't initialized logging.
    Logger.logError("test", "An error occurred");
    Logger.logWarning("test", "A warning occurred");
    Logger.logInfo("test", "An info message");
    Logger.logTrace("test", "An trace message");

    assert.isFalse(Logger.isEnabled("test", LogLevel.Error));
    assert.isFalse(Logger.isEnabled("test", LogLevel.Warning));
    assert.isFalse(Logger.isEnabled("test", LogLevel.Info));
    assert.isFalse(Logger.isEnabled("test", LogLevel.Trace));
  });

  it("static logger metadata", () => {
    const aProps = `"a":"hello"`;
    const meta1Props = `"prop1":"test1","prop2":"test2","prop3":"test3"`;
    const meta2Props = `"value2":"v2"`;

    let out = Logger.stringifyMetaData({ a: "hello" });
    assert.equal(out, `{${aProps}}`);

    // use a function for static metadata
    Logger.staticMetaData.set("meta1", () => ({ prop1: "test1", prop2: "test2", prop3: "test3" }));

    out = Logger.stringifyMetaData({ a: "hello" });
    assert.equal(out, `{${meta1Props},${aProps}}`);

    // use an object for static metadata
    Logger.staticMetaData.set("meta2", { value2: "v2" });

    // metadata from an object
    out = Logger.stringifyMetaData({ a: "hello" });
    assert.equal(out, `{${meta1Props},${meta2Props},${aProps}}`);

    // metadata from a function
    out = Logger.stringifyMetaData(() => ({ a: "hello" }));
    assert.equal(out, `{${meta1Props},${meta2Props},${aProps}}`);

    // even if there's no metadata, you should still get static metadata
    out = Logger.stringifyMetaData();
    assert.equal(out, `{${meta1Props},${meta2Props}}`);

    // delete static metadata
    Logger.staticMetaData.delete("meta1");
    out = Logger.stringifyMetaData({ a: "hello" });
    assert.equal(out, `{${meta2Props},${aProps}}`, "meta2 still exists");

    Logger.staticMetaData.delete("meta2");
    out = Logger.stringifyMetaData({ a: "hello" });
    // no static metadata
    assert.equal(out, `{${aProps}}`);

    // no metadata at all
    out = Logger.stringifyMetaData();
    assert.equal(out, "");
  });

  it("levels", () => {

    Logger.initialize(
      (c, m, d) => outerr = [c, m, d],
      (c, m, d) => outwarn = [c, m, d],
      (c, m, d) => outinfo = [c, m, d],
      (c, m, d) => outtrace = [c, m, d]);

    const c1msg: [string, string, FunctionReturningAny | undefined] = ["c1", "message1", () => "metaData1"];
    const c2msg: [string, string, FunctionReturningAny | undefined] = ["c2", "message2", undefined];
    const c3msg: [string, string, FunctionReturningAny | undefined] = ["c3", "message3", undefined];
    const c4msg: [string, string, FunctionReturningAny | undefined] = ["c4", "message4", () => 4];

    clearOutlets();

    // By default all categories are off (at any level)
    Logger.logTrace.apply(null, c1msg);
    checkOutlets([], [], [], []);
    Logger.logInfo.apply(null, c1msg);
    checkOutlets([], [], [], []);
    Logger.logWarning.apply(null, c1msg);
    checkOutlets([], [], [], []);
    Logger.logError.apply(null, c1msg);
    checkOutlets([], [], [], []);

    Logger.logTrace.apply(null, c2msg);
    checkOutlets([], [], [], []);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets([], [], [], []);
    Logger.logWarning.apply(null, c2msg);
    checkOutlets([], [], [], []);
    Logger.logError.apply(null, c2msg);
    checkOutlets([], [], [], []);

    // Now, turn the categories on at various levels

    //  c1 logs at the highest level
    Logger.setLevel("c1", LogLevel.Error);
    Logger.logTrace.apply(null, c1msg);
    checkOutlets([], [], [], []);
    Logger.logInfo.apply(null, c1msg);
    checkOutlets([], [], [], []);
    Logger.logWarning.apply(null, c1msg);
    checkOutlets([], [], [], []);
    Logger.logError.apply(null, c1msg);
    checkOutlets(c1msg, [], [], []);

    //  c2 logs at the warning level and up
    Logger.setLevel("c2", LogLevel.Warning);
    Logger.logTrace.apply(null, c2msg);
    checkOutlets([], [], [], []);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets([], [], [], []);
    Logger.logWarning.apply(null, c2msg);
    checkOutlets([], c2msg, [], []);
    Logger.logError.apply(null, c2msg);
    checkOutlets(c2msg, [], [], []);

    //  c3 logs at the info level and up
    Logger.setLevel("c3", LogLevel.Info);
    Logger.logTrace.apply(null, c3msg);
    checkOutlets([], [], [], []);
    Logger.logInfo.apply(null, c3msg);
    checkOutlets([], [], c3msg, []);
    Logger.logWarning.apply(null, c3msg);
    checkOutlets([], c3msg, [], []);
    Logger.logError.apply(null, c3msg);
    checkOutlets(c3msg, [], [], []);

    //  c4 logs at the trace level and up
    Logger.setLevel("c4", LogLevel.Trace);
    Logger.logTrace.apply(null, c4msg);
    checkOutlets([], [], [], c4msg);
    Logger.logInfo.apply(null, c4msg);
    checkOutlets([], [], c4msg, []);
    Logger.logWarning.apply(null, c4msg);
    checkOutlets([], c4msg, [], []);
    Logger.logError.apply(null, c4msg);
    checkOutlets(c4msg, [], [], []);

    // Now remove the error logging function. Nothing should log at that level. We should still see messages at other levels.
    Logger.initialize(
      undefined,
      (c, m, d) => outwarn = [c, m, d],
      (c, m, d) => outinfo = [c, m, d],
      (c, m, d) => outtrace = [c, m, d]);

    Logger.setLevel("c1", LogLevel.Warning);
    Logger.logError.apply(null, c1msg);
    checkOutlets([], [], [], []);
    Logger.logWarning.apply(null, c1msg);
    checkOutlets([], c1msg, [], []);

    Logger.logTrace.apply(null, c4msg);
    checkOutlets([], [], [], []); // c4 is not turned on at all

    // Set a default level
    Logger.initialize(
      (c, m, d) => outerr = [c, m, d],
      (c, m, d) => outwarn = [c, m, d],
      (c, m, d) => outinfo = [c, m, d],
      (c, m, d) => outtrace = [c, m, d]);

    Logger.setLevelDefault(LogLevel.Info);
    Logger.setLevel("c1", LogLevel.Warning);

    Logger.logTrace.apply(null, c4msg);
    checkOutlets([], [], [], []); // c4 should still not come out at the Trace level
    Logger.logInfo.apply(null, c4msg);
    checkOutlets([], [], c4msg, []); // ... but it should come out at the default Info level, even though we never turned on c4, since Info is the default level that applies to all categories.
    Logger.logWarning.apply(null, c1msg);
    checkOutlets([], c1msg, [], []);  // c1 should still come out at the warning level
    Logger.logInfo.apply(null, c1msg);
    checkOutlets([], [], [], []);  // ... but not at the Info level, even though that's the default level, because c1 has a specific level setting

    // ... now turn c4 off.
    Logger.setLevel("c4", LogLevel.None);
    Logger.logInfo.apply(null, c4msg);
    checkOutlets([], [], [], []); // Even though the default log level is Info, c4 should not come out at any level.
    Logger.logWarning.apply(null, c4msg);
    checkOutlets([], [], [], []); // Even though the default log level is Info, c4 should not come out at any level.
    Logger.logError.apply(null, c4msg);
    checkOutlets([], [], [], []); // Even though the default log level is Info, c4 should not come out at any level.

    // parent.child
    Logger.initialize(
      (c, m, d) => outerr = [c, m, d],
      (c, m, d) => outwarn = [c, m, d],
      (c, m, d) => outinfo = [c, m, d],
      (c, m, d) => outtrace = [c, m, d]);

    Logger.setLevel("g1", LogLevel.Trace);
    Logger.setLevel("g2", LogLevel.Error);
    Logger.logWarning("g1.m1", "g1.m1's message");
    checkOutlets([], ["g1.m1", "g1.m1's message"], [], []);
    Logger.logWarning("g2.m2", "g2.m2's message");
    checkOutlets([], [], [], []);
    Logger.logError("g2.m2", "g2.m2's message");
    checkOutlets(["g2.m2", "g2.m2's message"], [], [], []);

    // Multi-level parent.parent.child
    Logger.initialize(
      (c, m, d) => outerr = [c, m, d],
      (c, m, d) => outwarn = [c, m, d],
      (c, m, d) => outinfo = [c, m, d],
      (c, m, d) => outtrace = [c, m, d]);
    Logger.setLevel("g1", LogLevel.Trace);
    Logger.setLevel("g1.p1", LogLevel.Error);
    Logger.logWarning("g1.p1.c1", "unexpected");
    checkOutlets([], [], [], []); // Since the immediate parent's level is error, then warnings on the child should not appear
    Logger.logError("g1.p1.c1", "expected");
    checkOutlets(["g1.p1.c1", "expected"], [], [], []); // Since the immediate parent's level is error, then warnings on the child should not appear
    Logger.logWarning("g1.p2.c2", "expected");
    checkOutlets([], ["g1.p2.c2", "expected"], [], []); // Since the grandparent's level is trace and there is no level specified for the parent, then warnings on the grandchild should appear
  });

  it("turn on levels using config object", () => {
    Logger.initialize(
      (c, m, d) => outerr = [c, m, d],
      (c, m, d) => outwarn = [c, m, d],
      (c, m, d) => outinfo = [c, m, d],
      (c, m, d) => outtrace = [c, m, d]);

    const c1msg: [string, string, FunctionReturningAny | undefined] = ["c1", "message1", () => "metaData1"];
    const c2msg: [string, string, FunctionReturningAny | undefined] = ["c2", "message2", undefined];

    clearOutlets();
    Logger.configureLevels({
      categoryLevels: [
        { category: "c1", logLevel: "Error" },
      ],
    });

    Logger.logError.apply(null, c1msg);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets(c1msg, [], [], []);
    clearOutlets();

    clearOutlets();
    Logger.turnOffCategories();
    Logger.turnOffLevelDefault();
    Logger.configureLevels({
      categoryLevels: [
        { category: "c2", logLevel: "Warning" },
      ],
    });

    Logger.logError.apply(null, c1msg);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets([], [], [], []);
    clearOutlets();

    Logger.logError.apply(null, c1msg);
    Logger.logWarning.apply(null, c2msg);
    checkOutlets([], c2msg, [], []);
    clearOutlets();

    Logger.turnOffCategories();
    Logger.turnOffLevelDefault();
    Logger.configureLevels({
      defaultLevel: "Trace",
      categoryLevels: [
        { category: "c1", logLevel: "Error" },
      ],
    });

    Logger.logError.apply(null, c1msg);
    Logger.logWarning.apply(null, c2msg);
    checkOutlets(c1msg, c2msg, [], []);
    clearOutlets();
  });

  it("Catch invalid config object", () => {
    Logger.initialize(
      (c, m, d) => outerr = [c, m, d],
      (c, m, d) => outwarn = [c, m, d],
      (c, m, d) => outinfo = [c, m, d],
      (c, m, d) => outtrace = [c, m, d]);

    callLoggerConfigLevels({ categoryLevels: { stuff: 0 } }, true);
    callLoggerConfigLevels({ xcategoryLevels: [{ category: "c1", logLevel: "Error" }] }, true);
    callLoggerConfigLevels({ categoryLevels: [{ xcategory: "c1", logLevel: "Error" }] }, true);
    callLoggerConfigLevels({ categoryLevels: [{ category: "c1", xlogLevel: "Error" }] }, true);
    callLoggerConfigLevels({ categoryLevels: [{ category: "c1", xlogLevel: "Error" }] }, true);
    callLoggerConfigLevels({ categoryLevels: [{ category: "c1", logLevel: "XError" }] }, true);
    callLoggerConfigLevels({ xdefaultLevel: 0 }, true);
    callLoggerConfigLevels({ defaultLevel: "XError" }, true);
  });

  it("turn on logging for a few categories", () => {

    Logger.initialize(
      (c, m, d) => outerr = [c, m, d],
      (c, m, d) => outwarn = [c, m, d],
      (c, m, d) => outinfo = [c, m, d],
      (c, m, d) => outtrace = [c, m, d]);

    const c1msg: [string, string, FunctionReturningAny | undefined] = ["c1", "message1", () => "metaData1"];
    const c2msg: [string, string, FunctionReturningAny | undefined] = ["c2", "message2", undefined];

    clearOutlets();

    Logger.setLevel("c1", LogLevel.Info);
    Logger.logError.apply(null, c1msg);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets(c1msg, [], [], []);
    clearOutlets();

    Logger.setLevelDefault(LogLevel.Trace);
    Logger.logError.apply(null, c1msg);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets(c1msg, [], c2msg, []);
    clearOutlets();

    Logger.turnOffLevelDefault();
    Logger.logError.apply(null, c1msg);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets(c1msg, [], [], []);
    clearOutlets();

    Logger.turnOffCategories();
    Logger.logError.apply(null, c1msg);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets([], [], [], []);
    clearOutlets();

    Logger.setLevelDefault(LogLevel.Trace);
    Logger.logError.apply(null, c1msg);
    Logger.logInfo.apply(null, c2msg);
    checkOutlets(c1msg, [], c2msg, []);
    clearOutlets();
  });

  it("Performance logger", async () => {
    const perfMessages = new Array<string>();
    const perfData = new Array<any>();
    Logger.initialize(undefined, undefined,
      (category, message, metadata?: LoggingMetaData) => {
        if (category === "Performance") {
          perfMessages.push(message);

          const data = metadata ? BentleyError.getMetaData(metadata) : {};
          perfData.push(data);
        }
      }, undefined);

    await using(new PerfLogger("mytestroutine"), async (_r) => {
      await BeDuration.wait(10);
    });
    assert.isEmpty(perfMessages);

    Logger.setLevel("Performance", LogLevel.Info);

    await using(new PerfLogger("mytestroutine2"), async (_r) => {
      await BeDuration.wait(10);
    });

    assert.equal(perfMessages.length, 2);
    assert.equal(perfMessages[0], "mytestroutine2,START");
    assert.equal(perfMessages[1], "mytestroutine2,END");
    assert.isDefined(perfData[1].TimeElapsed);
    assert.isAbove(perfData[1].TimeElapsed, 8);
    perfMessages.pop();
    perfMessages.pop();

    const outerPerf = new PerfLogger("outer call");
    const innerPerf = new PerfLogger("inner call");
    for (let i = 0; i < 1000; i++) {
      if (i % 2 === 0)
        continue;
    }
    innerPerf.dispose();
    for (let i = 0; i < 1000; i++) {
      if (i % 2 === 0)
        continue;
    }
    outerPerf.dispose();
    assert.equal(perfMessages.length, 4);
    assert.equal(perfMessages[0], "outer call,START");
    assert.equal(perfMessages[1], "inner call,START");
    assert.equal(perfMessages[2], "inner call,END");
    assert.equal(perfMessages[3], "outer call,END");
  });

  it("should log exceptions", () => {
    Logger.initialize(
      (c, m, d) => outerr = [c, m, BentleyError.getMetaData(d)],
      (c, m, d) => outwarn = [c, m, BentleyError.getMetaData(d)],
      (c, m, d) => outinfo = [c, m, BentleyError.getMetaData(d)],
      (c, m, d) => outtrace = [c, m, BentleyError.getMetaData(d)]);
    Logger.setLevel("testcat", LogLevel.Error);

    clearOutlets();
    try {
      throw new Error("error message");
    } catch (err: any) {
      Logger.logException("testcat", err);
    }
    checkOutlets(["testcat", "Error: error message", { ExceptionType: "Error" }], [], [], []);

  });

});

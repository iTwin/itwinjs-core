/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { using, Logger, LogLevel, PerfLogger, DbResult } from "../bentleyjs-core";
import { EnvMacroSubst } from "../Logger";
import { BentleyError } from "../BentleyError";

let outerr: any[];
let outwarn: any[];
let outinfo: any[];
let outtrace: any[];

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

  it("envvar subst", () => {
    process.env.test1 = "test1";
    process.env.test2 = "test2";

    assert.equal(EnvMacroSubst.replace("${test1}"), "test1");
    assert.equal(EnvMacroSubst.replace(" ${test1}"), " test1");
    assert.equal(EnvMacroSubst.replace("${test1} "), "test1 ");
    assert.equal(EnvMacroSubst.replace("${test2}"), "test2");
    assert.equal(EnvMacroSubst.replace("${test1}${test2}"), "test1test2");
    assert.equal(EnvMacroSubst.replace("-${test1}-${test2}-"), "-test1-test2-");
    // should fail
    assert.equal(EnvMacroSubst.replace("${testx}"), "${testx}");
    assert.equal(EnvMacroSubst.replace("$(test1)"), "$(test1)");

    const testObj: any = {
      prop1: "${test1}",
      prop2: "${test2}",
      propx: "${testx}",
      propy: "${testy}",
      i: 1,
      a: ["${test1}", "${test2}"],
      nested: {
        nestedprop1: "${test1}",
        nestedprop2: "${test2}",
        nestedpropy: "${testy}",
        j: 2,
      },
    };
    assert.isTrue(EnvMacroSubst.anyPropertyContainsEnvvars(testObj, true));
    EnvMacroSubst.replaceInProperties(testObj, true, { testy: "testy" });
    assert.isTrue(EnvMacroSubst.anyPropertyContainsEnvvars(testObj, true)); // still contains ${testx}, which looks like a macro
    assert.equal(testObj.prop1, "test1");
    assert.equal(testObj.prop2, "test2");
    assert.equal(testObj.propx, "${testx}");
    assert.equal(testObj.propy, "testy");
    assert.equal(testObj.i, 1);
    assert.equal(testObj.a[0], "test1");
    assert.equal(testObj.a[1], "test2");
    assert.equal(testObj.nested.nestedprop1, "test1");
    assert.equal(testObj.nested.nestedprop2, "test2");
    assert.equal(testObj.nested.nestedpropy, "testy");
    assert.equal(testObj.nested.j, 2);
  });

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

  it("Performance logger", () => {
    const perfMessages = new Array<string>();
    Logger.initialize(undefined, undefined,
      (category, message, _metadata) => {
        if (category === "Performance")
          perfMessages.push(message);
      }, undefined);

    using(new PerfLogger("mytestroutine"), () => {
      for (let i = 0; i < 1000; i++) {
        if (i % 2 === 0)
          continue;
      }
    });
    assert.isEmpty(perfMessages);

    Logger.setLevel("Performance", LogLevel.Info);

    using(new PerfLogger("mytestroutine2"), () => {
      for (let i = 0; i < 1000; i++) {
        if (i % 2 === 0)
          continue;
      }
    });

    assert.equal(perfMessages.length, 2);
    assert.equal(perfMessages[0], "mytestroutine2,START");
    assert.isTrue(perfMessages[1].startsWith("mytestroutine2,END,"));
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
    assert.isTrue(perfMessages[2].startsWith("inner call,END,"));
    assert.isTrue(perfMessages[3].startsWith("outer call,END,"));
  });

  it("should log exceptions", () => {
    Logger.initialize(
      (c, m, d) => outerr = [c, m, d ? d() : {}],
      (c, m, d) => outwarn = [c, m, d ? d() : {}],
      (c, m, d) => outinfo = [c, m, d ? d() : {}],
      (c, m, d) => outtrace = [c, m, d ? d() : {}]);
    Logger.setLevel("testcat", LogLevel.Error);

    clearOutlets();
    try {
      throw new Error("error message");
    } catch (err) {
      Logger.logException("testcat", err);
    }
    checkOutlets(["testcat", "Error: error message", { ExceptionType: "Error" }], [], [], []);

    clearOutlets();
    try {
      throw new BentleyError(DbResult.BE_SQLITE_ERROR, "bentley error message", Logger.logError, "testcat", () => ({ MyProp: "mypropvalue" }));
    } catch (_err) {
    }
    checkOutlets(["testcat", "BE_SQLITE_ERROR: bentley error message", { MyProp: "mypropvalue", ExceptionType: "BentleyError" }], [], [], []);
  });

  it("log should capture ActivityId", () => {
    Logger.initialize(
      (c, m, d) => outerr = [c, m, d ? d() : {}],
      (c, m, d) => outwarn = [c, m, d ? d() : {}],
      (c, m, d) => outinfo = [c, m, d ? d() : {}],
      (c, m, d) => outtrace = [c, m, d ? d() : {}]);
    Logger.setLevel("testcat", LogLevel.Error);

    let activityId = "activity1";
    Logger.activityIdGetter = () => activityId;

    clearOutlets();
    Logger.logError("testcat", "message1");
    checkOutlets(["testcat", "message1", { ActivityId: activityId }], [], [], []);

    clearOutlets();
    activityId = "activity2";
    Logger.logError("testcat", "message2");
    checkOutlets(["testcat", "message2", { ActivityId: activityId }], [], [], []);

    clearOutlets();
    try {
      throw new BentleyError(DbResult.BE_SQLITE_ERROR, "bentley error message", Logger.logError, "testcat", () => ({ MyProp: "mypropvalue" }));
    } catch (_err) {
    }
    checkOutlets(["testcat", "BE_SQLITE_ERROR: bentley error message", { MyProp: "mypropvalue", ActivityId: activityId, ExceptionType: "BentleyError" }], [], [], []);
  });

});

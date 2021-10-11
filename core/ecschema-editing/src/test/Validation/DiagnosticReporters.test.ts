/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { BentleyError, Logger } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { EntityClass, PrimitiveProperty, PrimitiveType, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { FormatDiagnosticReporter } from "../../ecschema-editing";
import { MutableClass } from "../../Editing/Mutable/MutableClass";
import { AnyDiagnostic, createPropertyDiagnosticClass, DiagnosticCategory } from "../../Validation/Diagnostic";
import { LoggingDiagnosticReporter } from "../../Validation/LoggingDiagnosticReporter";

import sinon = require("sinon");

class TestDiagnosticReporter extends FormatDiagnosticReporter {
  constructor(suppressions?: Map<string, string[]>) {
    super(suppressions);
  }
  public reportDiagnostic(_diagnostic: AnyDiagnostic, _messageText: string) {
  }
}

describe("DiagnosticReporters tests", () => {

  let testSchema: Schema;
  let testSchemaItem: EntityClass;
  let testProperty: PrimitiveProperty;
  let testDiagnostics: AnyDiagnostic[];

  async function createTestDiagnostic(category: DiagnosticCategory, messageArgs: any[] = ["Param1", "Param2"]): Promise<AnyDiagnostic> {
    testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    testSchemaItem = new EntityClass(testSchema, "TestEntity");
    testProperty = await (testSchemaItem as unknown as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    const diagnosticClass = createPropertyDiagnosticClass("TestRuleSet-100", "Test Message {0} {1}");
    const diagnostic = new diagnosticClass(testProperty, messageArgs, category);
    // These were added to a test collection because the generator, createAsyncIterableDiagnostic,
    // can only be consumed once, hence the need for the collection, which allows the tests access
    // to the created diagnostics.
    testDiagnostics.push(diagnostic);
    return diagnostic;
  }

  beforeEach(() => {
    testDiagnostics = [];
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("FormatDiagnosticReporter tests", () => {
    it("suppressions specified, suppressions set correctly", async () => {
      const suppressions = new Map<string, string[]>();
      suppressions.set("schema1", ["code1"]);
      suppressions.set("schema1", ["code2"]);
      const reporter = new TestDiagnosticReporter(suppressions);

      expect(reporter.suppressions).equals(suppressions);
    });

    it("no suppressions, should call reportDiagnostic correctly", async () => {
      const reporter = new TestDiagnosticReporter();
      const reportDiagnostic = sinon.stub(reporter, "reportDiagnostic");
      const diag = await createTestDiagnostic(DiagnosticCategory.Error);

      reporter.report(diag);

      expect(reportDiagnostic.calledOnceWith(diag, "Test Message Param1 Param2")).to.be.true;
    });

    it("rules code not in suppressions, should call reportDiagnostic correctly", async () => {
      const diag = await createTestDiagnostic(DiagnosticCategory.Error);
      const suppressions = new Map<string, string[]>();
      suppressions.set(testSchema.fullName, ["randomCode"]);
      const reporter = new TestDiagnosticReporter(suppressions);
      const reportDiagnostic = sinon.stub(reporter, "reportDiagnostic");

      reporter.report(diag);

      expect(reportDiagnostic.calledOnceWith(diag, "Test Message Param1 Param2")).to.be.true;
    });

    it("diagnostic suppressed, should not call reportDiagnostic", async () => {
      const diag = await createTestDiagnostic(DiagnosticCategory.Error);
      const suppressions = new Map<string, string[]>();
      suppressions.set(testSchema.fullName, [diag.code]);
      const reporter = new TestDiagnosticReporter(suppressions);
      const reportDiagnostic = sinon.stub(reporter, "reportDiagnostic");

      reporter.report(diag);

      expect(reportDiagnostic.notCalled).to.be.true;
    });

  });

  describe("LoggingDiagnosticReporter tests", () => {
    it("should log expected error", async () => {
      const logMessage = sinon.stub(Logger, "logError");
      const reporter = new LoggingDiagnosticReporter();
      const diag = await createTestDiagnostic(DiagnosticCategory.Error);

      reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Test Message Param1 Param2")).to.be.true;
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = BentleyError.getMetaData(metaDataFunc) as any;
      assert.isDefined(metaData);
      expect(metaData.code).to.equal("TestRuleSet-100");
      expect(metaData.category).to.equal(DiagnosticCategory.Error);
      expect(metaData.ecDefinition).to.equal(testProperty);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.messageArgs).to.be.undefined;
    });

    it("should log expected error with translated message", async () => {
      const i18n = new EmptyLocalization();
      const i18nMock = sinon.mock(i18n);
      const translate = i18nMock.expects("getLocalizedString");
      translate.returns("Translated text {0} {1}");
      const logMessage = sinon.stub(Logger, "logError");
      const reporter = new LoggingDiagnosticReporter(undefined, i18n);
      const diag = await createTestDiagnostic(DiagnosticCategory.Error);

      reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Translated text Param1 Param2")).to.be.true;
    });

    it("no message args, should log expected error with translated message", async () => {
      const i18n = new EmptyLocalization();
      const i18nMock = sinon.mock(i18n);
      const translate = i18nMock.expects("getLocalizedString");
      translate.returns("Translated text");
      const logMessage = sinon.stub(Logger, "logError");
      const reporter = new LoggingDiagnosticReporter(undefined, i18n);
      const diag = await createTestDiagnostic(DiagnosticCategory.Error, []);

      reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Translated text")).to.be.true;
    });

    it("should log expected warning", async () => {
      const logMessage = sinon.stub(Logger, "logWarning");
      const reporter = new LoggingDiagnosticReporter();
      const diag = await createTestDiagnostic(DiagnosticCategory.Warning);

      reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Test Message Param1 Param2")).to.be.true;
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = BentleyError.getMetaData(metaDataFunc) as any;
      assert.isDefined(metaData);
      expect(metaData.code).to.equal("TestRuleSet-100");
      expect(metaData.category).to.equal(DiagnosticCategory.Warning);
      expect(metaData.ecDefinition).to.equal(testProperty);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.messageArgs).to.be.undefined;
    });

    it("should log expected message", async () => {
      const logMessage = sinon.stub(Logger, "logInfo");
      const reporter = new LoggingDiagnosticReporter();
      const diag = await createTestDiagnostic(DiagnosticCategory.Message);

      reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Test Message Param1 Param2")).to.be.true;
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = BentleyError.getMetaData(metaDataFunc) as any;
      assert.isDefined(metaData);
      expect(metaData.code).to.equal("TestRuleSet-100");
      expect(metaData.category).to.equal(DiagnosticCategory.Message);
      expect(metaData.ecDefinition).to.equal(testProperty);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.messageArgs).to.be.undefined;
    });

    it("should log expected suggestion", async () => {
      const logMessage = sinon.stub(Logger, "logInfo");
      const reporter = new LoggingDiagnosticReporter();
      const diag = await createTestDiagnostic(DiagnosticCategory.Suggestion);

      reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Test Message Param1 Param2")).to.be.true;
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = BentleyError.getMetaData(metaDataFunc) as any;
      assert.isDefined(metaData);
      expect(metaData.code).to.equal("TestRuleSet-100");
      expect(metaData.category).to.equal(DiagnosticCategory.Suggestion);
      expect(metaData.ecDefinition).to.equal(testProperty);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.messageArgs).to.be.undefined;
    });
  });
});


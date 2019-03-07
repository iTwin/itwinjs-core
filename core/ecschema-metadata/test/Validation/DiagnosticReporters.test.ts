/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@bentley/bentleyjs-core";
import { I18N, I18NNamespace } from "@bentley/imodeljs-i18n";
import { assert, expect } from "chai";
import sinon = require("sinon");

import { PrimitiveType } from "../../src/ECObjects";
import { EntityClass, PrimitiveProperty, Schema, SchemaContext } from "../../src/ecschema-metadata";
import { ECClass, MutableClass } from "../../src/Metadata/Class";
import { AnyDiagnostic, createPropertyDiagnosticClass, DiagnosticCategory } from "../../src/Validation/Diagnostic";
import { LoggingDiagnosticReporter } from "../../src/Validation/LoggingDiagnosticReporter";

describe("DiagnosticReporters tests", () => {
  let testSchema: Schema;
  let testSchemaItem: EntityClass;
  let testProperty: PrimitiveProperty;
  let testDiagnostics: AnyDiagnostic[];

  async function createTestDiagnostic(category: DiagnosticCategory, messageArgs: any[] = ["Param1", "Param2"]): Promise<AnyDiagnostic> {
    testSchema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
    testSchemaItem = new EntityClass(testSchema, "TestEntity");
    testProperty = await (testSchemaItem as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
    const diagnosticClass = createPropertyDiagnosticClass("TestRuleSet:100", "Test Message {0} {1}", category);
    const diagnostic = new diagnosticClass(testProperty, messageArgs);
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

  describe("LoggingDiagnosticReporter tests", () => {
    it("should log expected error", async () => {
      const logMessage = sinon.stub(Logger, "logError");
      const reporter = new LoggingDiagnosticReporter();
      const diag = await createTestDiagnostic(DiagnosticCategory.Error);

      await reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Test Message Param1 Param2")).to.be.true;
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = metaDataFunc!();
      assert.isDefined(metaData);
      expect(metaData.code).to.equal("TestRuleSet:100");
      expect(metaData.category).to.equal(DiagnosticCategory.Error);
      expect(metaData.ecDefinition).to.equal(testProperty);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.messageArgs).to.be.undefined;
    });

    it("should log expected error with translated message", async () => {
      const i18n = new I18N([], "");
      const i18nMock = sinon.mock(i18n);
      const registerNamespace = i18nMock.expects("registerNamespace");
      registerNamespace.resolves(new I18NNamespace("ECSchemaMetaData", Promise.resolve()));
      const translate = i18nMock.expects("translate");
      translate.returns("Translated text {0} {1}");
      const logMessage = sinon.stub(Logger, "logError");
      const reporter = new LoggingDiagnosticReporter(i18n);
      const diag = await createTestDiagnostic(DiagnosticCategory.Error);

      await reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Translated text Param1 Param2")).to.be.true;
    });

    it("no message args, should log expected error with translated message", async () => {
      const i18n = new I18N([], "");
      const i18nMock = sinon.mock(i18n);
      const registerNamespace = i18nMock.expects("registerNamespace");
      registerNamespace.resolves(new I18NNamespace("ECSchemaMetaData", Promise.resolve()));
      const translate = i18nMock.expects("translate");
      translate.returns("Translated text");
      const logMessage = sinon.stub(Logger, "logError");
      const reporter = new LoggingDiagnosticReporter(i18n);
      const diag = await createTestDiagnostic(DiagnosticCategory.Error, []);

      await reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Translated text")).to.be.true;
    });

    it("should log expected warning", async () => {
      const logMessage = sinon.stub(Logger, "logWarning");
      const reporter = new LoggingDiagnosticReporter();
      const diag = await createTestDiagnostic(DiagnosticCategory.Warning);

      await reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Test Message Param1 Param2")).to.be.true;
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = metaDataFunc!();
      assert.isDefined(metaData);
      expect(metaData.code).to.equal("TestRuleSet:100");
      expect(metaData.category).to.equal(DiagnosticCategory.Warning);
      expect(metaData.ecDefinition).to.equal(testProperty);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.messageArgs).to.be.undefined;
    });

    it("should log expected message", async () => {
      const logMessage = sinon.stub(Logger, "logInfo");
      const reporter = new LoggingDiagnosticReporter();
      const diag = await createTestDiagnostic(DiagnosticCategory.Message);

      await reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Test Message Param1 Param2")).to.be.true;
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = metaDataFunc!();
      assert.isDefined(metaData);
      expect(metaData.code).to.equal("TestRuleSet:100");
      expect(metaData.category).to.equal(DiagnosticCategory.Message);
      expect(metaData.ecDefinition).to.equal(testProperty);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.messageArgs).to.be.undefined;
    });

    it("should log expected suggestion", async () => {
      const logMessage = sinon.stub(Logger, "logInfo");
      const reporter = new LoggingDiagnosticReporter();
      const diag = await createTestDiagnostic(DiagnosticCategory.Suggestion);

      await reporter.report(diag);

      expect(logMessage.calledOnceWith("ecschema-metadata", "Test Message Param1 Param2")).to.be.true;
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = metaDataFunc!();
      assert.isDefined(metaData);
      expect(metaData.code).to.equal("TestRuleSet:100");
      expect(metaData.category).to.equal(DiagnosticCategory.Suggestion);
      expect(metaData.ecDefinition).to.equal(testProperty);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.messageArgs).to.be.undefined;
    });
  });
});

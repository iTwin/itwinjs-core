/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { TestMessages } from "../TestUtils/I18NTestHelper";
import sinon = require("sinon");
import { Logger } from "@bentley/bentleyjs-core";
import * as Diagnostics from "../../src/Validation/Diagnostics";
import * as Reporters from "../../src/Validation/DiagnosticReporters";
import { SchemaItem, Schema, EntityClass } from "../../src/ecschema-metadata";
import { ECValidationError } from "../../src/Validation/ValidationException";

describe("DiagnosticReporters tests", () => {
  function createDiagnostic(message: Diagnostics.DiagnosticMessage, translation: string, schemaItem?: SchemaItem, propertyName?: string | undefined): Diagnostics.Diagnostic {
    return {
      schema: schemaItem ? schemaItem.schema : undefined,
      schemaItem: schemaItem,
      schemaItemType: schemaItem ? schemaItem.schemaItemType : undefined,
      propertyName: propertyName,

      defaultMessageText: message.message,
      messageText: translation,
      category: message.category,
      code: message.code,
    };
  }

  afterEach(() => {
    sinon.restore();
  });

  describe("LoggingDiagnosticReporter tests", () => {
    let schema: Schema;
    let schemaItem: SchemaItem;
    let propertyName: string;

    beforeEach(() => {
      schema = new Schema("TestSchema", 1, 0, 0);
      schemaItem = new EntityClass(schema, "TestEntity");
      propertyName = "TestProperty";
    });

    it("should log expected error", async () => {
      const logMessage = sinon.stub(Logger, "logError");
      const reporter = new Reporters.LoggingDiagnosticReporter();
      const diag = createDiagnostic(TestMessages.TestErrorA, "test translation", schemaItem, propertyName);

      reporter.report(diag);

      expect(logMessage.calledOnceWithExactly("ecschema-metadata", TestMessages.TestErrorA.message));
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = metaDataFunc!();
      assert.isDefined(metaData);
      expect(metaData.code).to.equal(Diagnostics.ECValidationStatus.BaseClassIsSealed);
      expect(metaData.category).to.equal(Diagnostics.DiagnosticCategory.Error);
      expect(metaData.schema).to.equal(schema);
      expect(metaData.schemaItem).to.equal(schemaItem);
      expect(metaData.propertyName).to.equal(propertyName);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.defaultMessageText).to.be.undefined;
    });

    it("should log expected warning", async () => {
      const logMessage = sinon.stub(Logger, "logWarning");
      const reporter = new Reporters.LoggingDiagnosticReporter();
      const diag = createDiagnostic(TestMessages.TestWarning, "test translation", schemaItem, propertyName);

      reporter.report(diag);

      expect(logMessage.calledOnceWithExactly("ecschema-metadata", TestMessages.TestErrorA.message));
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = metaDataFunc!();
      assert.isDefined(metaData);
      expect(metaData.code).to.equal(Diagnostics.ECValidationStatus.BaseClassIsSealed);
      expect(metaData.category).to.equal(Diagnostics.DiagnosticCategory.Warning);
      expect(metaData.schema).to.equal(schema);
      expect(metaData.schemaItem).to.equal(schemaItem);
      expect(metaData.propertyName).to.equal(propertyName);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.defaultMessageText).to.be.undefined;
    });

    it("should log expected message", async () => {
      const logMessage = sinon.stub(Logger, "logInfo");
      const reporter = new Reporters.LoggingDiagnosticReporter();
      const diag = createDiagnostic(TestMessages.TestMessage, "test translation", schemaItem, propertyName);

      reporter.report(diag);

      expect(logMessage.calledOnceWithExactly("ecschema-metadata", TestMessages.TestErrorA.message));
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = metaDataFunc!();
      assert.isDefined(metaData);
      expect(metaData.code).to.equal(Diagnostics.ECValidationStatus.BaseClassIsSealed);
      expect(metaData.category).to.equal(Diagnostics.DiagnosticCategory.Message);
      expect(metaData.schema).to.equal(schema);
      expect(metaData.schemaItem).to.equal(schemaItem);
      expect(metaData.propertyName).to.equal(propertyName);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.defaultMessageText).to.be.undefined;
    });

    it("should log expected suggestion", async () => {
      const logMessage = sinon.stub(Logger, "logInfo");
      const reporter = new Reporters.LoggingDiagnosticReporter();
      const diag = createDiagnostic(TestMessages.TestSuggestion, "test translation", schemaItem, propertyName);

      reporter.report(diag);

      expect(logMessage.calledOnceWithExactly("ecschema-metadata", TestMessages.TestErrorA.message));
      const metaDataFunc = logMessage.firstCall.args[2];
      assert.isDefined(metaDataFunc);
      const metaData = metaDataFunc!();
      assert.isDefined(metaData);
      expect(metaData.code).to.equal(Diagnostics.ECValidationStatus.BaseClassIsSealed);
      expect(metaData.category).to.equal(Diagnostics.DiagnosticCategory.Suggestion);
      expect(metaData.schema).to.equal(schema);
      expect(metaData.schemaItem).to.equal(schemaItem);
      expect(metaData.propertyName).to.equal(propertyName);
      expect(metaData.messageText).to.be.undefined;
      expect(metaData.defaultMessageText).to.be.undefined;
    });
  });

  describe("ExceptionDiagnosticReporter tests", () => {

    it("Error diagnostic, should throw expected error", async () => {
      const reporter = new Reporters.ExceptionDiagnosticReporter();
      const diag = createDiagnostic(TestMessages.TestErrorA, "test translation");

      assert.throws(() => reporter.report(diag), ECValidationError, "test translation");
    });

    it("Warning diagnostic, should not throw error", async () => {
      const reporter = new Reporters.ExceptionDiagnosticReporter();
      const diag = createDiagnostic(TestMessages.TestWarning, "test translation");

      reporter.report(diag);
    });

    it("Message diagnostic, should not throw error", async () => {
      const reporter = new Reporters.ExceptionDiagnosticReporter();
      const diag = createDiagnostic(TestMessages.TestMessage, "test translation");

      reporter.report(diag);
    });

    it("Suggestion diagnostic, should not throw error", async () => {
      const reporter = new Reporters.ExceptionDiagnosticReporter();
      const diag = createDiagnostic(TestMessages.TestSuggestion, "test translation");

      reporter.report(diag);
    });
  });

  describe("CollectionDiagnosticReporter tests", () => {

    it("Error diagnostic, should throw expected error", async () => {
      const reporter = new Reporters.CollectionDiagnosticReporter();
      const diag1 = createDiagnostic(TestMessages.TestErrorA, "test translation");
      const diag2 = createDiagnostic(TestMessages.TestErrorB, "test translation");

      reporter.report(diag1);
      reporter.report(diag2);

      expect(reporter.ReportedDiagnostics[0]).to.equal(diag1);
      expect(reporter.ReportedDiagnostics[1]).to.equal(diag2);
    });
  });
});


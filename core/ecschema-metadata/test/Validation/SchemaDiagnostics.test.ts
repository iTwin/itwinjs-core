/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IDiagnosticReporter, Diagnostic } from "../../src/Validation/Diagnostics";
import { SchemaDiagnosticReporter } from "../../src/Validation/SchemaDiagnostics";
import { I18NTestHelper, TestMessages } from "../TestUtils/I18NTestHelper";
import sinon = require("sinon");
import { Schema } from "../../src/Metadata/Schema";
import { EntityClass } from "../../src/Metadata/EntityClass";
import { I18N, I18NNamespace } from "@bentley/imodeljs-i18n";

describe("SchemaDiagnosticReporter tests", () => {

  class TestReporter implements IDiagnosticReporter {
    public report(diagnostic: Diagnostic) {
      console.assert(diagnostic !== undefined);
    }
  }

  afterEach(() => {
    SchemaDiagnosticReporter.shutdown();
    I18NTestHelper.cleanup();
    sinon.restore();
  });

  it("startup, i18n specified, registerNamespace called correctly", async () => {
    const i18n = new I18N([], "");
    const i18nMock = sinon.mock(i18n);
    const registerNamespace = i18nMock.expects("registerNamespace");
    registerNamespace.resolves(new I18NNamespace("ECSchemaMetaData", Promise.resolve()));
    expect(!SchemaDiagnosticReporter.initialized);
    await SchemaDiagnosticReporter.startup(i18n);
    expect(registerNamespace.calledOnceWithExactly("ECSchemaMetaData"));
    expect(SchemaDiagnosticReporter.initialized);
  });

  it("startup, i18n not specified, initialized is true", async () => {
    expect(!SchemaDiagnosticReporter.initialized);
    await SchemaDiagnosticReporter.startup(undefined);
    expect(SchemaDiagnosticReporter.initialized);
  });

  it("startup called twice, registerNamespace called once", async () => {
    const i18n = new I18N([], "");
    const i18nMock = sinon.mock(i18n);
    const registerNamespace = i18nMock.expects("registerNamespace");
    registerNamespace.resolves(new I18NNamespace("ECSchemaMetaData", Promise.resolve()));
    expect(!SchemaDiagnosticReporter.initialized);
    await SchemaDiagnosticReporter.startup(i18n);
    await SchemaDiagnosticReporter.startup(i18n);
    expect(registerNamespace.calledOnceWithExactly("ECSchemaMetaData"));
  });

  it("register reporter succeeds", async () => {
    await SchemaDiagnosticReporter.startup(undefined);
    const reporter = new TestReporter;
    SchemaDiagnosticReporter.registerReporter(reporter);
    expect(SchemaDiagnosticReporter.reporters[0]).to.equal(reporter)
  });

  it("shutdown succeeds", async () => {
    await SchemaDiagnosticReporter.startup(undefined);
    expect(SchemaDiagnosticReporter.initialized);
    SchemaDiagnosticReporter.registerReporter(new TestReporter);
    SchemaDiagnosticReporter.shutdown();
    expect(!SchemaDiagnosticReporter.initialized);
    expect(SchemaDiagnosticReporter.reporters.length).to.equal(0)
  });

  it("reportDiagnostic, no translation, succeeds", async () => {
    const report = sinon.spy(TestReporter.prototype, "report");
    await SchemaDiagnosticReporter.startup(undefined);
    expect(SchemaDiagnosticReporter.initialized);
    SchemaDiagnosticReporter.registerReporter(new TestReporter);

    SchemaDiagnosticReporter.reportDiagnostic(TestMessages.TestErrorA, "Param1");

    expect(report.calledOnce);
    const diagnostic = report.args[0][0] as Diagnostic;
    expect(diagnostic).not.undefined;
    expect(diagnostic.category).equals(TestMessages.TestErrorA.category);
    expect(diagnostic.code).equals(TestMessages.TestErrorA.code);
    expect(diagnostic.defaultMessageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.messageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.schema).is.undefined;
    expect(diagnostic.schemaItem).is.undefined;
    expect(diagnostic.propertyName).is.undefined;
  });

  it("reportDiagnostic, with translation, succeeds", async () => {
    const i18n = new I18N([], "");
    const i18nMock = sinon.mock(i18n);
    const registerNamespace = i18nMock.expects("registerNamespace");
    registerNamespace.resolves(new I18NNamespace("ECSchemaMetaData", Promise.resolve()));
    const translate = i18nMock.expects("translate");
    translate.returns("Translated Text '{0}'");
    const report = sinon.spy(TestReporter.prototype, "report");
    await SchemaDiagnosticReporter.startup(i18n);
    SchemaDiagnosticReporter.registerReporter(new TestReporter);

    SchemaDiagnosticReporter.reportDiagnostic(TestMessages.TestErrorA, "Param1");

    expect(translate.calledOnceWithExactly("ECSchemaMetaData:Diagnostics" + TestMessages.TestErrorA.key));
    expect(report.calledOnce);
    const diagnostic = report.args[0][0] as Diagnostic;
    expect(diagnostic).not.undefined;
    expect(diagnostic.defaultMessageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.messageText).equals("Translated Text 'Param1'");
  });

  it("reportSchemaDiagnostic, succeeds", async () => {
    const report = sinon.spy(TestReporter.prototype, "report");
    await SchemaDiagnosticReporter.startup(undefined);
    expect(SchemaDiagnosticReporter.initialized);
    SchemaDiagnosticReporter.registerReporter(new TestReporter);

    const schema = new Schema("TestSchema", 1, 0, 0);
    SchemaDiagnosticReporter.reportSchemaDiagnostic(schema, TestMessages.TestErrorA, "Param1");

    expect(report.calledOnce);
    const diagnostic = report.args[0][0] as Diagnostic;
    expect(diagnostic).not.undefined;
    expect(diagnostic.category).equals(TestMessages.TestErrorA.category);
    expect(diagnostic.code).equals(TestMessages.TestErrorA.code);
    expect(diagnostic.defaultMessageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.messageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.schema).equals(schema);
    expect(diagnostic.schemaItem).is.undefined;
    expect(diagnostic.propertyName).is.undefined;
  });

  it("reportSchemaItemDiagnostic, succeeds", async () => {
    const report = sinon.spy(TestReporter.prototype, "report");
    await SchemaDiagnosticReporter.startup(undefined);
    expect(SchemaDiagnosticReporter.initialized);
    SchemaDiagnosticReporter.registerReporter(new TestReporter);

    const schema = new Schema("TestSchema", 1, 0, 0);
    const schemaItem = new EntityClass(schema, "TestEntity");
    SchemaDiagnosticReporter.reportSchemaItemDiagnostic(schemaItem, TestMessages.TestErrorA, "Param1");

    expect(report.calledOnce);
    const diagnostic = report.args[0][0] as Diagnostic;
    expect(diagnostic).not.undefined;
    expect(diagnostic.category).equals(TestMessages.TestErrorA.category);
    expect(diagnostic.code).equals(TestMessages.TestErrorA.code);
    expect(diagnostic.defaultMessageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.messageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.schema).equals(schema);
    expect(diagnostic.schemaItem).equals(schemaItem);
    expect(diagnostic.propertyName).is.undefined;
  });

  it("reportPropertyDiagnostic, succeeds", async () => {
    const report = sinon.spy(TestReporter.prototype, "report");
    await SchemaDiagnosticReporter.startup(undefined);
    expect(SchemaDiagnosticReporter.initialized);
    SchemaDiagnosticReporter.registerReporter(new TestReporter);

    const schema = new Schema("TestSchema", 1, 0, 0);
    const schemaItem = new EntityClass(schema, "TestEntity");
    SchemaDiagnosticReporter.reportSchemaPropertyDiagnostic(schemaItem, "TestProperty", TestMessages.TestErrorA, "Param1");

    expect(report.calledOnce);
    const diagnostic = report.args[0][0] as Diagnostic;
    expect(diagnostic).not.undefined;
    expect(diagnostic.category).equals(TestMessages.TestErrorA.category);
    expect(diagnostic.code).equals(TestMessages.TestErrorA.code);
    expect(diagnostic.defaultMessageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.messageText).equals("Test message with parameter 'Param1'");
    expect(diagnostic.schema).equals(schema);
    expect(diagnostic.schemaItem).equals(schemaItem);
    expect(diagnostic.propertyName).equals("TestProperty");
  });
});

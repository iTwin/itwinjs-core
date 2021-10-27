/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ConditionalStringValue } from "@itwin/appui-abstract";
import { PropsHelper } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("PropsHelper", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("Shallow Equals", () => {
    const obj1 = { firstName: "John", lastName: "Doe", address: "101 Main Street", zip: 10101 };
    const obj2 = { firstName: "John", lastName: "Doe", address: "101 Main Street", zip: 10101 };
    expect(PropsHelper.isShallowEqual(obj1, obj2)).to.eq(true);

    const obj3 = { firstName: "John", lastName: "Doe", address: "102 Main Street", zip: 10101 };
    expect(PropsHelper.isShallowEqual(obj1, obj3)).to.eq(false);
  });

  it("Get Icon JSX", () => {
    const iconTest = PropsHelper.getIcon("placeholder");
    expect(iconTest).not.to.be.undefined;
    expect(iconTest!.props.iconSpec).to.eq("placeholder");
  });

  it("Get undefined Icon", () => {
    const iconTest = PropsHelper.getIcon(null);
    expect(iconTest).to.be.undefined;
  });

  let outString: string | undefined;
  const stringGetter = () => "Got String?";

  it("String spec", () => {
    const defaultStringSpec = PropsHelper.getStringSpec("Hello World!");
    expect(defaultStringSpec).not.to.be.undefined;
    expect(defaultStringSpec).to.eq("Hello World!");
  });

  it("StringGetter spec", () => {
    const stringGetterSpec = PropsHelper.getStringSpec(stringGetter);
    expect(stringGetterSpec).not.to.be.undefined;
    outString = undefined;
    outString = PropsHelper.getStringFromSpec(stringGetterSpec);
    expect(outString).not.to.be.undefined;
    expect(outString).to.eq("Got String?");
  });

  it("Explicit String spec - key ignored since explicit string specified", () => {
    const stringAndKeySpec = PropsHelper.getStringSpec(stringGetter, "UiFramework:snapModeField.snapMode");
    expect(stringAndKeySpec).not.to.be.undefined;
    outString = undefined;
    outString = PropsHelper.getStringFromSpec(stringAndKeySpec);
    expect(outString).not.to.be.undefined;
    expect(outString).to.eq("Got String?");
  });

  it("Use stringKey for undefined explicitValue", () => {
    const undefinedStringAndKeySpec = PropsHelper.getStringSpec(undefined, "UiFramework:snapModeField.snapMode");
    expect(undefinedStringAndKeySpec).not.to.be.undefined;
    outString = undefined;
    outString = PropsHelper.getStringFromSpec(undefinedStringAndKeySpec);
    expect(outString).not.to.be.undefined;
    expect(outString).to.eq("snapModeField.snapMode"); // since test are not setting up localization we get string without namespace.
  });

  it("Use stringKey for blank explicitValue", () => {
    const undefinedStringAndKeySpec = PropsHelper.getStringSpec("", "UiFramework:snapModeField.snapMode");
    expect(undefinedStringAndKeySpec).not.to.be.undefined;
    outString = undefined;
    outString = PropsHelper.getStringFromSpec(undefinedStringAndKeySpec);
    expect(outString).not.to.be.undefined;
    expect(outString).to.eq("snapModeField.snapMode"); // since test are not setting up localization we get string without namespace.
  });

  it("Use ConditionalStringValue for label", () => {
    const conditionalStringSpec = PropsHelper.getStringSpec(new ConditionalStringValue(() => "HelloWorld", ["dummy"]));
    expect(conditionalStringSpec).not.to.be.undefined;
    outString = undefined;
    outString = PropsHelper.getStringFromSpec(conditionalStringSpec);
    expect(outString).not.to.be.undefined;
    expect(outString).to.eq("HelloWorld");
  });

  it("Get Icon from ConditionalStringValue", () => {
    const iconTest = PropsHelper.getIcon(new ConditionalStringValue(() => "conditional-icon", ["dummy"]));
    expect(iconTest).not.to.be.undefined;
    expect(iconTest!.props.iconSpec).to.eq("conditional-icon");
  });

});

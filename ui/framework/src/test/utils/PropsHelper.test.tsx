/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { PropsHelper } from "../../utils/PropsHelper";

describe("PropsHelper", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
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

  it("Use stringKey", () => {
    const undefinedStringAndKeySpec = PropsHelper.getStringSpec(undefined, "UiFramework:snapModeField.snapMode");
    expect(undefinedStringAndKeySpec).not.to.be.undefined;
    outString = undefined;
    outString = PropsHelper.getStringFromSpec(undefinedStringAndKeySpec);
    expect(outString).not.to.be.undefined;
    expect(outString).to.eq("snapModeField.snapMode"); // since test are not setting up localization we get string without namespace.
  });

});

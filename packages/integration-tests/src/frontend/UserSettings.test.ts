/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { initialize, terminate } from "../IntegrationTests";
import { createRandomId } from "@helpers/random";
import { Id64, using } from "@bentley/bentleyjs-core";
import { PresentationRuleSet, SettingValueTypes, IUserSettingsManager } from "@common/index";
import { ECPresentation } from "@bentley/ecpresentation-frontend";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("UserSettings", async () => {

  let settings: IUserSettingsManager;
  const ruleset: PresentationRuleSet = require("../../test-rulesets/UserSettings/default");

  beforeEach(() => {
    settings = ECPresentation.presentation.settings(ruleset.ruleSetId);
  });

  it("get setting added through ruleset", async () => {
    await using(await ECPresentation.presentation.rulesets().add(ruleset), async () => {
      const actualValue = await settings.getString(ruleset.userSettings![0].settingsItems![0].id);
      expect(actualValue).to.be.equal(ruleset.userSettings![0].settingsItems![0].defaultValue);
    });
  });

  it("adds and modifies string setting", async () => {
    const value = faker.random.word();
    const settingId = "stringSetting";
    await settings.setValue(settingId, { value, type: SettingValueTypes.String });
    const actualValue = await settings.getString(settingId);
    expect(actualValue).to.be.equal(value);
  });

  it("adds and modifies boolean setting", async () => {
    let value = faker.random.boolean();
    const settingId = "booleanSetting";
    await settings.setValue(settingId, { value, type: SettingValueTypes.Bool });
    let actualValue = await settings.getBoolean(settingId);
    expect(actualValue).to.be.equal(value);

    value = !value;
    await settings.setValue(settingId, { value, type: SettingValueTypes.Bool });
    actualValue = await settings.getBoolean(settingId);
    expect(actualValue).to.be.equal(value);
  });

  it("adds and modifies integer setting", async () => {
    let value = faker.random.number();
    const settingId = "intSetting";
    await settings.setValue(settingId, { value, type: SettingValueTypes.Int });
    let actualValue = await settings.getInt(settingId);
    expect(actualValue).to.be.equal(value);

    value = faker.random.number();
    await settings.setValue(settingId, { value, type: SettingValueTypes.Int });
    actualValue = await settings.getInt(settingId);
    expect(actualValue).to.be.equal(value);
  });

  it("adds and modifies array of integers setting", async () => {
    let valueArray = [faker.random.number(), faker.random.number(), faker.random.number()];
    const settingId = "intArraySetting";
    await settings.setValue(settingId, { value: valueArray, type: SettingValueTypes.IntArray });
    let actualValueArray = await settings.getIntArray(settingId);
    expect(actualValueArray).to.be.deep.equal(valueArray);

    valueArray = [faker.random.number(), faker.random.number(), faker.random.number(), faker.random.number()];
    await settings.setValue(settingId, { value: valueArray, type: SettingValueTypes.IntArray });
    actualValueArray = await settings.getIntArray(settingId);
    expect(actualValueArray).to.be.deep.equal(valueArray);
  });

  it("adds and modifies id64 setting", async () => {
    let value = createRandomId();
    const settingId = "id64Setting";
    await settings.setValue(settingId, { value, type: SettingValueTypes.Id64 });
    let actualValue = await settings.getId64(settingId);
    expect(actualValue.equals(value)).to.be.true;

    value = createRandomId();
    await settings.setValue(settingId, { value, type: SettingValueTypes.Id64 });
    actualValue = await settings.getId64(settingId);
    expect(actualValue.equals(value)).to.be.true;
  });

  it("adds and modifies array of id64 setting", async () => {

    let valueArray = [
      createRandomId(),
      createRandomId(),
      createRandomId(),
    ];
    const settingId = "id64ArraySetting";
    await settings.setValue(settingId, { value: valueArray, type: SettingValueTypes.Id64Array });
    let actualValueArray = await settings.getId64Array(settingId);
    expect(actualValueArray).to.be.deep.equal(valueArray);

    valueArray = [
      createRandomId(),
      createRandomId(),
      createRandomId(),
      createRandomId(),
    ];
    await settings.setValue(settingId, { value: valueArray, type: SettingValueTypes.Id64Array });
    actualValueArray = await settings.getId64Array(settingId);
    expect(actualValueArray).to.be.deep.equal(valueArray);
  });

  it("accessing int array setting with different types", async () => {
    const valueArray = [faker.random.number(), faker.random.number(), faker.random.number(), faker.random.number()];
    const settingId = "intArraySetting";
    await settings.setValue(settingId, { value: valueArray, type: SettingValueTypes.IntArray });

    const boolValue = await settings.getBoolean(settingId);
    expect(boolValue).to.be.false;

    const id64ArrayValue = await settings.getId64Array(settingId);
    expect(id64ArrayValue.length).to.be.equal(valueArray.length);
    for (const value of valueArray) {
      const id = new Id64([value, 0]);
      expect(id64ArrayValue.find((x) => x.equals(id))).to.not.be.equal(undefined);
    }

    const id64Value = await settings.getId64(settingId);
    expect(id64Value.value).to.be.equal("0");

    const intValue = await settings.getInt(settingId);
    expect(intValue).to.be.equal(0);

    const stringValue = await settings.getString(settingId);
    expect(stringValue).to.be.equal("");
  });

  it("accessing int setting with different types", async () => {
    const value = faker.random.number();
    const settingId = "intSetting";
    await settings.setValue(settingId, { value, type: SettingValueTypes.Int });

    const boolValue = await settings.getBoolean(settingId);
    expect(boolValue).to.be.true;

    const id64ArrayValue = await settings.getId64Array(settingId);
    expect(id64ArrayValue.length).to.be.equal(0);

    const id64Value = await settings.getId64(settingId);
    expect(id64Value.equals(new Id64([value, 0]))).to.be.true;

    const intArrayValue = await settings.getIntArray(settingId);
    expect(intArrayValue.length).to.be.equal(0);

    const stringValue = await settings.getString(settingId);
    expect(stringValue).to.be.equal("");
  });

  it("accessing bool setting with different types", async () => {
    const value = faker.random.boolean();
    const settingId = "boolSetting";
    await settings.setValue(settingId, { value, type: SettingValueTypes.Bool });

    const id64ArrayValue = await settings.getId64Array(settingId);
    expect(id64ArrayValue.length).to.be.equal(0);

    const id64Value = await settings.getId64(settingId);
    expect(id64Value.equals(new Id64([value ? 1 : 0, 0]))).to.be.true;

    const intArrayValue = await settings.getIntArray(settingId);
    expect(intArrayValue.length).to.be.equal(0);

    const intValue = await settings.getInt(settingId);
    expect(intValue).to.be.equal(value ? 1 : 0);

    const stringValue = await settings.getString(settingId);
    expect(stringValue).to.be.equal("");
  });

  it("accessing string setting with different types", async () => {
    const value = faker.random.word();
    const settingId = "stringSetting";
    await settings.setValue(settingId, { value, type: SettingValueTypes.String });

    const id64ArrayValue = await settings.getId64Array(settingId);
    expect(id64ArrayValue.length).to.be.equal(0);

    const id64Value = await settings.getId64(settingId);
    expect(id64Value.equals(new Id64([0, 0]))).to.be.true;

    const intArrayValue = await settings.getIntArray(settingId);
    expect(intArrayValue.length).to.be.equal(0);

    const intValue = await settings.getInt(settingId);
    expect(intValue).to.be.equal(0);

    const boolValue = await settings.getBoolean(settingId);
    expect(boolValue).to.be.equal(false);
  });

  it("accessing id64 setting with different types", async () => {
    const value = createRandomId();
    const settingId = "id64Setting";
    await settings.setValue(settingId, { value, type: SettingValueTypes.Id64 });

    const id64ArrayValue = await settings.getId64Array(settingId);
    expect(id64ArrayValue.length).to.be.equal(0);

    const intArrayValue = await settings.getIntArray(settingId);
    expect(intArrayValue.length).to.be.equal(0);

    const stringValue = await settings.getString(settingId);
    expect(stringValue).to.be.equal("");

    const boolValue = await settings.getBoolean(settingId);
    expect(boolValue).to.be.equal(!value.equals(new Id64([0, 0])) ? true : false);
  });

  it("accessing id64 array setting with different types", async () => {
    const valueArray = [
      createRandomId(),
      createRandomId(),
      createRandomId(),
      createRandomId(),
    ];
    const settingId = "id64ArraySetting";
    await settings.setValue(settingId, { value: valueArray, type: SettingValueTypes.Id64Array });

    const boolValue = await settings.getBoolean(settingId);
    expect(boolValue).to.be.false;

    const intArrayValue = await settings.getIntArray(settingId);
    expect(intArrayValue.length).to.be.equal(valueArray.length);

    const id64Value = await settings.getId64(settingId);
    expect(id64Value.value).to.be.equal("0");

    const intValue = await settings.getInt(settingId);
    expect(intValue).to.be.equal(0);

    const stringValue = await settings.getString(settingId);
    expect(stringValue).to.be.equal("");
  });

});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import { expect } from "chai";
import { LocalUiSettings, UiSettingsStatus } from "../../ui-core";
const storageMock = () => {
  const storage: { [key: string]: any } = {};
  return {
    setItem: (key: string, value: string) => {
      storage[key] = value || "";
    },
    getItem: (key: string) => {
      return key in storage ? storage[key] : null;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (i: number) => {
      const keys = Object.keys(storage);
      return keys[i] || null;
    },
  };
};
describe("LocalUiSettings", () => {
  it("default constructor executes successfully", () => {
    const initialLocalUiSettings = new LocalUiSettings();
    expect(initialLocalUiSettings).to.not.be.undefined;
  });
  describe("saveSetting", () => {
    const localUiSettings = new LocalUiSettings({ localStorage: storageMock() } as Window);
    it("Should save setting correctly", async () => {
      const result = await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
      expect(result.status).to.equal(UiSettingsStatus.Success);
    });
  });
  describe("getSetting", async () => {
    const localUiSettings = new LocalUiSettings({ localStorage: storageMock() } as Window);
    await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    it("Should load setting correctly", async () => {
      const result = await localUiSettings.getSetting("Testing", "TestData");
      expect(result.status).to.equal(UiSettingsStatus.Success);
      expect(result.setting).to.not.be.null;
      expect(result.setting.test123).to.equal("4567");
    });
    it("Should return error result if setting not found", async () => {
      const result = await localUiSettings.getSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiSettingsStatus.NotFound);
    });
  });
  describe("deleteSetting", async () => {
    const localUiSettings = new LocalUiSettings({ localStorage: storageMock() } as Window);
    await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    it("Should remove setting correctly", async () => {
      const result = await localUiSettings.deleteSetting("Testing", "TestData");
      expect(result.status).to.equal(UiSettingsStatus.Success);
      const result2 = await localUiSettings.deleteSetting("Testing", "TestData");
      expect(result2.status).to.equal(UiSettingsStatus.NotFound);
      expect(result2.setting).to.be.undefined;
    });
    it("Should return error result if setting not found", async () => {
      const result = await localUiSettings.deleteSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiSettingsStatus.NotFound);
    });
  });
});

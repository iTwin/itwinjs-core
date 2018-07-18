/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64 } from "@bentley/bentleyjs-core";

/** Possible value types for user settings. */
export const enum SettingValueTypes {
  /** Integer value. */
  Int = "int",

  /** Array of integer values. */
  IntArray = "intArray",

  /** Boolean value. */
  Bool = "bool",

  /** String value. */
  String = "string",

  /** Id64 value. */
  Id64 = "id64",

  /** Array of Id64 values. */
  Id64Array = "id64Array",

}

/** Base interface for setting value. */
export interface BaseSetting {
  /** Type of setting value. */
  type: SettingValueTypes;

  /** Setting value. */
  value: any;
}

/** Interface for integer setting value. */
export interface IntegerSetting extends BaseSetting {
  type: SettingValueTypes.Int;
  value: number;
}

/** Interface for integer array setting value. */
export interface IntegerArraySetting extends BaseSetting {
  type: SettingValueTypes.IntArray;
  value: number[];
}

/** Interface for boolean setting value. */
export interface BooleanSetting extends BaseSetting {
  type: SettingValueTypes.Bool;
  value: boolean;
}

/** Interface for string setting value. */
export interface StringSetting extends BaseSetting {
  type: SettingValueTypes.String;
  value: string;
}

/** Interface for Id64 setting value. */
export interface Id64Setting extends BaseSetting {
  type: SettingValueTypes.Id64;
  value: Id64;
}

/** Interface for Id64 array setting value. */
export interface Id64ArraySetting extends BaseSetting {
  type: SettingValueTypes.Id64Array;
  value: Id64[];
}

/** Combines all types of user settings. */
export type SettingValue = IntegerSetting | IntegerArraySetting | BooleanSetting | StringSetting | Id64Setting | Id64ArraySetting;

/** Used for setting and accessing user settings. **[[ECPresentation]] must be initialized before using this.** */
export interface IUserSettingsManager {
  /**
   * Sets user setting value
   * @param settingId Id of a setting.
   * @param value Value and type.
   */
  setValue(settingId: string, value: SettingValue): Promise<void>;

  /**
   * Get user setting value
   * @param settingId Id of the setting to get
   * @param settingType Type of the setting
   */
  getValue(settingId: string, settingType: SettingValueTypes): Promise<boolean | string | number | number[] | Id64 | Id64[]>;

  /**
   * Retrieves boolean setting value. Returns default value if setting does not exist or does not convert to boolean.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getBoolean(settingId: string): Promise<boolean>;

  /**
   * Retrieves integer setting value. Returns default value if setting does not exist or does not convert to integer.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getInt(settingId: string): Promise<number>;

  /**
   * Retrieves integer array setting value. Returns default value if setting does not exist or does not convert to integer array.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getIntArray(settingId: string): Promise<number[]>;

  /**
   * Retrieves Id64 setting value. Returns default value if setting does not exist or does not convert to Id64.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getId64(settingId: string): Promise<Id64>;

  /**
   * Retrieves Id64 array setting value. Returns default value if setting does not exist or does not convert to Id64 array.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getId64Array(settingId: string): Promise<Id64[]>;

  /**
   * Retrieves string setting value. Returns default value if setting does not exist or does not convert to string.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getString(settingId: string): Promise<string>;
}

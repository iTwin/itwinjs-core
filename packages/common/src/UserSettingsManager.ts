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
export interface UserSettingsManager {
  /**
   * Sets user setting value
   * @param ruleSetId Id of a ruleset setting is associated with.
   * @param settingId Id of a setting.
   * @param value Value and type.
   */
  setValue(ruleSetId: string, settingId: string, value: SettingValue): Promise<void>;

  /**
   * Retrieves boolean setting value. Returns default value if setting does not exist or does not convert to boolean.
   * @param ruleSetId Id of a ruleset setting is associated with.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getBoolean(ruleSetId: string, settingId: string): Promise<boolean>;

  /**
   * Retrieves integer setting value. Returns default value if setting does not exist or does not convert to integer.
   * @param ruleSetId Id of a ruleset setting is associated with.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getInt(ruleSetId: string, settingId: string): Promise<number>;

  /**
   * Retrieves integer array setting value. Returns default value if setting does not exist or does not convert to integer array.
   * @param ruleSetId Id of a ruleset setting is associated with.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getIntArray(ruleSetId: string, settingId: string): Promise<number[]>;

  /**
   * Retrieves Id64 setting value. Returns default value if setting does not exist or does not convert to Id64.
   * @param ruleSetId Id of a ruleset setting is associated with.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getId64(ruleSetId: string, settingId: string): Promise<Id64>;

  /**
   * Retrieves Id64 array setting value. Returns default value if setting does not exist or does not convert to Id64 array.
   * @param ruleSetId Id of a ruleset setting is associated with.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getId64Array(ruleSetId: string, settingId: string): Promise<Id64[]>;

  /**
   * Retrieves string setting value. Returns default value if setting does not exist or does not convert to string.
   * @param ruleSetId Id of a ruleset setting is associated with.
   * @param settingId Id of a setting.
   * @return A promise object that returns setting value.
   */
  getString(ruleSetId: string, settingId: string): Promise<string>;
}

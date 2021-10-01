/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

/** Class used to return a boolean value. The boolean value is refreshed by using the specified function. The syncEventIds define one or more
 * eventIds that would require the testFunc to be rerun.
 * @public
 */
export class ConditionalBooleanValue {
  private _value?: boolean;

  /**
   * Constructor for ConditionalBooleanValue. It is important that the same ConditionalBooleanValue instance is not used by multiple UI item definitions in order that the control's state is always rendered correctly.
   * @param testFunc Function to run to retrieve the value for the conditional. This function is run when refresh method is called or if the value is not defined in the constructor.
   * @param syncEventIds An array of eventId that should be monitored to determine when to run the refresh method.
   * @param value The default value for the conditional value. If not specified then the function is run to set the value when the value is retrieved.
   */
  constructor(public readonly testFunc: () => boolean, public readonly syncEventIds: string[], value?: boolean) {
    this._value = value;
  }

  /** The current boolean value of the conditional. */
  public get value(): boolean {
    if (undefined !== this._value)
      return this._value;

    this._value = this.testFunc();
    return this._value;
  }

  /** Called to update the value by running the testFunc */
  public refresh(): boolean {
    const newValue = this.testFunc();
    if (newValue !== this._value) {
      this._value = newValue;
      return true;
    }
    return false;
  }

  /** helper function to process properties defined as type ConditionalBooleanValue | boolean | undefined */
  public static refreshValue(conditionalValue: ConditionalBooleanValue | boolean | undefined, eventIds: Set<string>): boolean {
    if (undefined === conditionalValue || !(conditionalValue instanceof ConditionalBooleanValue))
      return false;

    if (conditionalValue.syncEventIds.some((value: string): boolean => eventIds.has(value.toLowerCase())))
      return conditionalValue.refresh();

    return false;
  }

  /** helper function to get boolean from a ConditionalBooleanValue | boolean | undefined */
  public static getValue(conditionalValue: ConditionalBooleanValue | boolean | undefined): boolean {
    if (undefined === conditionalValue)
      return false;

    if (conditionalValue instanceof ConditionalBooleanValue)
      return conditionalValue.value;

    return conditionalValue;
  }
}

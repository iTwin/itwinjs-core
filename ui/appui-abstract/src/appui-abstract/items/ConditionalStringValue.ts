/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

/** Class used to return a string value. The string value is refreshed by using the specified function. The syncEventIds define one or more
 * eventIds that would require the stringGetter function to be rerun.
 * @public
 */
export class ConditionalStringValue {
  private _value?: string;

  /**
   * Constructor for ConditionalStringValue. It is important that the same ConditionalStringValue instance is not used by multiple UI item definitions in order that the control's state is always rendered correctly.
   * @param stringGetter Function to run to retrieve the value for the conditional. This function is run when refresh method is called or if the value is not defined in the constructor.
   * @param syncEventIds An array of eventId that should be monitored to determine when to run the refresh method.
   * @param value The default value for the conditional value. If not specified then the function is run to set the value when the value is retrieved.
   */
  constructor(public readonly stringGetter: () => string, public readonly syncEventIds: string[], value?: string) {
    this._value = value;
  }

  /** The current boolean value of the conditional. */
  public get value(): string {
    if (undefined !== this._value)
      return this._value;

    this._value = this.stringGetter();
    return this._value;
  }

  /** Called to update the value by running the stringGetter */
  public refresh(): boolean {
    const newValue = this.stringGetter();
    if (newValue !== this._value) {
      this._value = newValue;
      return true;
    }
    return false;
  }

  /** helper function to process properties defined as type ConditionalStringValue | string | undefined
   * Return true if the value was updated.
   */
  public static refreshValue(conditionalValue: ConditionalStringValue | string | undefined, eventIds: Set<string>): boolean {
    if (undefined === conditionalValue || !(conditionalValue instanceof ConditionalStringValue))
      return false;

    if (conditionalValue.syncEventIds.some((value: string): boolean => eventIds.has(value.toLowerCase())))
      return conditionalValue.refresh();

    return false;
  }

  /** helper function to get string from a ConditionalStringValue | string | undefined */
  public static getValue(conditionalValue: ConditionalStringValue | string | undefined): string | undefined {
    if (undefined === conditionalValue)
      return undefined;

    if (conditionalValue instanceof ConditionalStringValue)
      return conditionalValue.value;

    return conditionalValue;
  }
}

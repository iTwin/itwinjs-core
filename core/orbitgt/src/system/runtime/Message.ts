/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

/**
 * Class Message prints debug, information, warning and error messages to the console.
 */
/** @internal */
export class Message {
  /** Disabled by default, enable to see all messages */
  public static DISPLAY: boolean = false;

  private constructor() {}

  public static log(message: string): void {
    if (Message.DISPLAY) console.log(message);
  }

  public static print(module: string, message: string): void {
    if (Message.DISPLAY) console.log(module + " : " + message);
  }

  public static printWarning(module: string, message: string): void {
    if (Message.DISPLAY) console.log("WARNING: " + module + " : " + message);
  }

  public static printError(
    module: string,
    exception: any,
    message: string
  ): void {
    if (Message.DISPLAY) console.log("ERROR: " + module + " : " + message);
    if (Message.DISPLAY && exception != null) console.log("" + exception);
  }
}

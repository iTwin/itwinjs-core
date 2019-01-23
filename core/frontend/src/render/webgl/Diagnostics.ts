/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { GL } from "./GL";
import { System } from "./System";

/** Provides facilities for conditionally executing diagnostic/debug code. By default, all facilities are disabled - they must be explicitly enabled. */
export class Debug {
  /** Whether [[Debug.assert]] will actually perform the assertion. */
  public static assertionsEnabled = false;
  /** Whether [[Debug.print]] will actually produce output. */
  public static printEnabled = false;
  /** Whether [[Debug.evaluate]] will actually evaluate an expression. */
  public static evaluateEnabled = false;

  /** If [[Debug.printEnabled]] is true, outputs a message using `console.log`.
   * @param message A function which returns a string. If [[Debug.printEnabled]] is false, the function is never evaluated.
   */
  public static print(message: () => string): void {
    if (this.printEnabled)
      console.log(message()); // tslint:disable-line:no-console
  }

  /** If [[Debug.assertionsEnabled]] is true, asserts that a condition is true. Otherwise, does nothing.
   * @param condition The function which evaluates the condition
   * @param message An optional custom message in the event that the supplied condition evaluates false, or a function returning such a message.
   * @note Supply a function for `message` if the message is not a string literal.
   */
  public static assert(condition: () => boolean, message?: string | (() => string)): void {
    if (this.assertionsEnabled) {
      if ("function" === typeof message)
        message = message();

      assert(condition(), undefined !== message ? message : "Rendering assertion failed.");
    }
  }

  /** If [[Debug.evaluate]] is true, executes the supplied function and returns its result; otherwise returns the supplied default value.
   * @param evaluate The function to execute
   * @param defaultValue The value to return if [[Debug.evaluate]] is false
   * @returns The return value of `evaluate` if [[Debug.evaluate]] is true; otherwise, the `defaultValue`.
   */
  public static evaluate<T>(evaluate: () => T, defaultValue: T): T {
    return this.evaluateEnabled ? evaluate() : defaultValue;
  }

  /** If [[Debug.evaluateEnabled]] is true, returns whether the currently-bound framebuffer is complete. */
  public static get isValidFrameBuffer(): boolean { return GL.FrameBuffer.Status.Complete === this.checkFrameBufferStatus(); }

  /** If [[Debug.evaluateEnabled]] is true, returns the status of the currently-bound framebuffer. */
  public static checkFrameBufferStatus(): GL.FrameBuffer.Status {
    return this.evaluate(() => System.instance.context.checkFramebufferStatus(GL.FrameBuffer.TARGET), GL.FrameBuffer.Status.Complete);
  }
}

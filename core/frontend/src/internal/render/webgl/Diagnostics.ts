/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { GL } from "./GL";
import { System } from "./System";

/** Provides facilities for conditionally executing diagnostic/debug code. By default, all facilities are disabled - they must be explicitly enabled.
 * @internal
 */
export class Debug {
  /** Whether [[Debug.print]] will actually produce output. */
  public static printEnabled = false;
  /** Whether [[Debug.evaluate]] will actually evaluate an expression. */
  public static evaluateEnabled = false;

  /** If [[Debug.printEnabled]] is true, outputs a message using `console.log`.
   * @param message A function which returns a string. If [[Debug.printEnabled]] is false, the function is never evaluated.
   */
  public static print(message: () => string): void {
    if (this.printEnabled)
      console.log(message()); // eslint-disable-line no-console
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

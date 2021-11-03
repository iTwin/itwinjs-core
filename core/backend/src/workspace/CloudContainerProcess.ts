/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { BlobDaemon } from "@bentley/imodeljs-native";
import { ChildProcess } from "child_process";
import { IModelHost } from "../IModelHost";

export class CloudContainerProcess {
  private static containerProcess?: ChildProcess;
  private static removeShutdownListener?: VoidFunction;
  private static kill() {
    if (this.containerProcess) {
      this.containerProcess.kill();
      this.containerProcess = undefined;
    }
  }

  public static get isRunning() { return undefined !== this.containerProcess; }
  public static start() {
    if (undefined === this.containerProcess)
      this.containerProcess = BlobDaemon.start({});

    // set up a listener to kill the containerProcess when we shut down
    this.removeShutdownListener = IModelHost.onBeforeShutdown.addOnce(() => this.kill());
  }

  public static stop() {
    this.kill();
    if (this.removeShutdownListener) {
      this.removeShutdownListener();
      this.removeShutdownListener = undefined;
    }
  }
}

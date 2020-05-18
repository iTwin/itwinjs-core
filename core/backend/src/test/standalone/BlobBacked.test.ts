/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BlobContainerProps, Daemon, DaemonProps } from "../../BlobBackedDaemon";

describe("Blob Backed Daemon", () => {
  it.only("should start daemon", () => {
    const daemonProps: DaemonProps = {
      account: "imodelhubdevsa01",
      log: "mepuc",
    };
    const container: BlobContainerProps = {
      name: "imodelblocks-3101cca9-707c-4c82-8ef4-7afccfbd2421",
      sasKey: "sv=2018-03-28&sr=c&sig=oOBChKATIVxbhMmlbEtYqaVD%2BYhVFmGAIw1IySaGzD4%3D&st=2020-05-15T15%3A04%3A48Z&se=2020-05-16T15%3A09%3A48Z&sp=rl",
    };

    Daemon.start(daemonProps);
  });
});

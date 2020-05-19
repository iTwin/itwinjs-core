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
      maxCacheSize: "10G",
    };

    const container: BlobContainerProps = {
      name: "imodelblocks-3101cca9-707c-4c82-8ef4-7afccfbd2421",
      sasKey: "sv=2018-03-28&sr=c&sig=pn9YCwV6OHtujAOkLy09BMrVggHIa%2B2%2BB0ZpSRBxfdA%3D&st=2020-05-18T16%3A29%3A56Z&se=2020-05-19T16%3A34%3A56Z&sp=rl",
    };

    Daemon.start(daemonProps);
    Daemon.attach(daemonProps, container);
    // Daemon.download(daemonProps, container, "a016840dd72272624a3b2afb56e5bc51b8874584", "d:/temp/kab.bim");
  });
});

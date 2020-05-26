/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BlobDaemon, BlobDbProps, BlobStorageType, BlobDaemonCommand } from "@bentley/imodeljs-native";
import { StopWatch } from "@bentley/bentleyjs-core";

describe("Blob Daemon", () => {
  it.skip("should start daemon", () => {

    const props: BlobDbProps = {
      account: "127.0.0.1:10000",
      log: "mepuc",
      storageType: BlobStorageType.AzureEmulator,
      maxCacheSize: "10G",
      container: "testcontainer",
      dbAlias: "test133",
      deleteTime: 10,
      gcTime: 10,
      sasKey: "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
    };

    const runCommand = (command: BlobDaemonCommand, props: BlobDbProps) => {
      const stopWatch = new StopWatch(command, true);
      const result = BlobDaemon.command(command, props);
      console.log(`command ${command}: ${stopWatch.elapsedSeconds}s`);
      assert.equal(result.result, 0, `command "${command}" result is "${result.errMsg}"`);
    }

    BlobDaemon.start(props);
    runCommand("create", props);
    runCommand("upload", { ...props, localFile: "d:/temp/test123.test.bim" });
    runCommand("attach", props);
    runCommand("copy", { ...props, toAlias: "test123" });
    runCommand("attach", props);
    runCommand("delete", { ...props, dbAlias: "test123" });
    runCommand("attach", props);
    runCommand("delete", props);
    // runCommand("detach", props);
  });
});

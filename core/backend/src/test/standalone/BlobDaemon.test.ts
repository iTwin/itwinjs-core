/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { StopWatch } from "@bentley/bentleyjs-core";
import { BlobDaemon, BlobDaemonCommand, BlobDbProps, BlobStorageType } from "@bentley/imodeljs-native";

describe.skip("Blob Daemon", () => {
  it("should start daemon", () => {

    const props: BlobDbProps = {
      account: "127.0.0.1:10000",
      log: "mepuc",
      storageType: BlobStorageType.AzureEmulator,
      maxCacheSize: "10G",
      container: "test-container",
      dbAlias: "test133",
      deleteTime: 10,
      pollTime: 600,
      writeable: true,
      shell: true,
      onProgress: (nDone: number, nTotal: number) => { console.log(`progress ${(nDone / nTotal) * 100.}%`); return 0; },
      gcTime: 10,
      sasKey: "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
    };

    const runCommand = (command: BlobDaemonCommand, props: BlobDbProps) => {
      const stopWatch = new StopWatch(command, true);
      const result = BlobDaemon.command(command, props);
      console.log(`command ${command}: ${stopWatch.elapsedSeconds}s`);
      assert.equal(result.result, 0, `command "${command}" result is "${result.errMsg}"`);
    };

    BlobDaemon.start(props);
    runCommand("create", props);
    runCommand("upload", { ...props, localFile: "d:/temp/test123.test.bim" });
    runCommand("attach", props);
    runCommand("copy", { ...props, toAlias: "test123" });
    runCommand("attach", props);
    runCommand("attach", { ...props, sasKey: "bogus" });
    console.log(`local file = "${BlobDaemon.getDbFileName(props)}"`);
    runCommand("download", { ...props, localFile: "d:/temp/downloaded.bim" });
    runCommand("delete", { ...props, dbAlias: "test123" });
    runCommand("attach", props);
    runCommand("delete", props);
    runCommand("attach", props);
    runCommand("detach", props);
    runCommand("destroy", props);
  });
});

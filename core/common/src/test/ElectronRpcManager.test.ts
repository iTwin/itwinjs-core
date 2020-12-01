/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { getIModelElectronApi } from "../rpc/electron/ElectronRpcManager";
import { assert } from "chai";

describe("Electron Rpc Manager", () => {
  it("getIModelElectron API undefined in node by default", () => {
    assert.isUndefined(getIModelElectronApi());
  });

  it("getIModelElectron API handles missing window", () => {
    (global as any).window = () => { };
    assert.isUndefined(getIModelElectronApi());
    delete (global as any).window;
  });

  it("getIModelElectron API succeeds", () => {
    (global as any).window = {
      imodeljs_api: { // eslint-disable-line @typescript-eslint/naming-convention
        invoke: async (_channel: string, ..._data: any[]): Promise<any> => { },
        // on: (_channel: string, _listener: any) => { },
        once: (_channel: string, _listener: any) => { },
        removeListener: (_channel: string, _listener: any) => { },
        send: (_channel: string, ..._data: any[]) => { },
        sendSync: (_channel: string, ..._args: any[]) => { },
      },
    };

    assert.isDefined(getIModelElectronApi());

    delete (global as any).window;
  });
});

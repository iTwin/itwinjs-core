/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ByteStream } from "@itwin/core-bentley";

export const createFakeTileResponse = (contentType: string, data?: Uint8Array) => {
  const test = {
    headers: new Headers( { "content-type" : contentType}),
    arrayBuffer: async () => {
      return Promise.resolve(data ? ByteStream.fromUint8Array(data).arrayBuffer : undefined);
    },
    status: 200,
  } as unknown;   // By using unknown type, I can define parts of Response I really need
  return (test as Response );
};

export const fakeTextFetch = (sandbox: sinon.SinonSandbox, text: string) => {
  return sandbox.stub(global, "fetch").callsFake(async function (_input: RequestInfo | URL, _init?: RequestInit) {
    return Promise.resolve((({
      text: async () => text,
      ok: true,
      status: 200,
    } as unknown) as Response));
  });
};

export const indexedArrayFromUrlParams = (urlParams: URLSearchParams):  {[key: string]: string} => {
  const array: {[key: string]: string} = {};
  urlParams.forEach((value: string, key: string) => {
    array[key] = value;
  });
  return array;
};

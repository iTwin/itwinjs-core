/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import type { Readable } from "stream";
import { BentleyStatus, IModelError } from "../../IModelError";
import type { RpcSerializedValue } from "../core/RpcMarshaling";
import type { HttpServerRequest } from "../web/WebAppRpcProtocol";

/** @internal */
export interface FormDataCommon {
  append(name: string, value: string | Blob | Buffer, fileName?: string): void;
}

/** @internal */
export interface ReadableFormData extends Readable {
  getHeaders(): { [key: string]: any };
}

/** Support for transporting RPC values using the HTTP multipart content type.
 * @internal
 */
export class RpcMultipart {
  /** Creates a multipart form object for an RPC value. */
  public static createForm(value: RpcSerializedValue): FormData {
    const form = new FormData();
    RpcMultipart.writeValueToForm(form, value);
    return form;
  }

  /** Creates a multipart stream for an RPC value. */
  public static createStream(_value: RpcSerializedValue): ReadableFormData {
    throw new IModelError(BentleyStatus.ERROR, "Not implemented.");
  }

  /** Obtains the RPC value from a multipart HTTP request. */
  public static async parseRequest(_req: HttpServerRequest): Promise<RpcSerializedValue> {
    throw new IModelError(BentleyStatus.ERROR, "Not implemented.");
  }

  /** @internal */
  public static writeValueToForm(form: FormDataCommon, value: RpcSerializedValue) {
    form.append("objects", value.objects);

    for (let i = 0; i !== value.data.length; ++i) {
      if (typeof (Blob) !== "undefined") {
        form.append(`data-${i}`, new Blob([value.data[i]], { type: "application/octet-stream" }));
      } else {
        const buf = value.data[i];
        form.append(`data-${i}`, Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
      }
    }
  }
}

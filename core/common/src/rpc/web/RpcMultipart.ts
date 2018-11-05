/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcSerializedValue } from "../core/RpcMarshaling";
import { Readable } from "stream";
import { HttpServerRequest } from "../web/WebAppRpcProtocol";
import { IModelError, BentleyStatus } from "../../IModelError";

/** @hidden */
export interface FormDataCommon {
  append(name: string, value: string | Blob | Buffer, fileName?: string): void;
}

/** @hidden */
export interface ReadableFormData extends Readable {
  getHeaders(): { [key: string]: any };
}

/** Support for transporting RPC values using the HTTP multipart content type. */
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
  public static parseRequest(_req: HttpServerRequest): Promise<RpcSerializedValue> {
    throw new IModelError(BentleyStatus.ERROR, "Not implemented.");
  }

  /** Obtains the RPC value from a multipart form object. */
  public static parseForm(form: FormData) {
    return new Promise<RpcSerializedValue>(async (resolve, reject) => {
      const value = RpcSerializedValue.create(form.get("objects") as string, []);

      let i = 0;
      for (; ;) {
        const data = form.get(`data-${i}`);
        if (!data) {
          break;
        }

        try {
          const buffer = await RpcMultipart.readFormBlob(data as Blob);
          value.data.push(new Uint8Array(buffer));
        } catch (err) {
          reject(err);
        }

        ++i;
      }

      resolve(value);
    });
  }

  /** @hidden */
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

  /** @hidden */
  public static readFormBlob(data: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener("load", () => {
        resolve(reader.result as ArrayBuffer);
      });

      reader.addEventListener("error", () => {
        reject(reader.error);
      });

      reader.readAsArrayBuffer(data as Blob);
    });
  }
}

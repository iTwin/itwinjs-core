/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus, IModelError } from "../../IModelError";
import { BackendBuffer, BackendReadable } from "../../BackendTypes";
import { RpcSerializedValue } from "../core/RpcMarshaling";
import { HttpServerRequest } from "../web/WebAppRpcProtocol";

/* eslint-disable deprecation/deprecation */

/** @internal */
export interface FormDataCommon {
  append(name: string, value: string | Blob | BackendBuffer, fileName?: string): void;
}

/** @internal */
export interface ReadableFormData extends BackendReadable {
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
  public static createStream(value: RpcSerializedValue): ReadableFormData {
    return this.platform.createStream(value);
  }

  /** Obtains the RPC value from a multipart HTTP request. */
  public static async parseRequest(req: HttpServerRequest): Promise<RpcSerializedValue> {
    return this.platform.parseRequest(req);
  }

  /** @internal */
  public static writeValueToForm(form: FormDataCommon, value: RpcSerializedValue) {
    form.append("objects", value.objects);

    for (let i = 0; i !== value.data.length; ++i) {
      this.platform.appendToForm(i, form, value);
    }
  }

  /** @internal */
  public static platform = {
    createStream(_value: RpcSerializedValue): ReadableFormData {
      throw new IModelError(BentleyStatus.ERROR, "Not bound.");
    },
    async parseRequest(_req: HttpServerRequest): Promise<RpcSerializedValue> {
      throw new IModelError(BentleyStatus.ERROR, "Not bound.");
    },
    appendToForm(i: number, form: FormDataCommon, value: RpcSerializedValue): void {
      form.append(`data-${i}`, new Blob([value.data[i]], { type: "application/octet-stream" }));
    },
  };
}


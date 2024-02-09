/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus, FormDataCommon, HttpServerRequest, IModelError, RpcMultipart, RpcSerializedValue } from "@itwin/core-common";
import * as formData from "form-data";
import * as multiparty from "multiparty";

/* eslint-disable deprecation/deprecation */

/** @internal */
export function createMultipartStream(value: RpcSerializedValue) {
  const form = new formData();
  RpcMultipart.writeValueToForm(form, value);
  // Type information for FormData is lying. It actually extends Stream but not Readable, although it appears to work
  // fine for now.
  return form;
}

/** @internal */
export async function parseMultipartRequest(req: HttpServerRequest) {
  return new Promise<RpcSerializedValue>((resolve, reject) => {
    const form = new multiparty.Form({ maxFieldsSize: Infinity });
    form.on("error", (err) => {
      reject(err);
    });

    const value = RpcSerializedValue.create();
    const data: { [index: string]: { size: number, chunks: Buffer[] } } = {};

    form.on("part", (part: multiparty.Part) => {
      part.on("data", (chunk: string | Buffer) => {
        if (part.name === "objects") {
          value.objects += chunk.toString();
        } else if (Buffer.isBuffer(chunk)) {
          if (!data[part.name]) {
            data[part.name] = { size: 0, chunks: [] };
          }

          data[part.name].size += chunk.byteLength;
          data[part.name].chunks.push(chunk);
        } else {
          throw new IModelError(BentleyStatus.ERROR, "Unknown input.");
        }
      });
    });

    form.on("close", () => {
      let i = 0;
      for (; ;) {
        const part = data[`data-${i}`];
        if (!part) {
          break;
        }

        value.data.push(Buffer.concat(part.chunks, part.size));
        ++i;
      }

      resolve(value);
    });

    form.parse(req);
  });
}

/** @internal */
export function appendToMultipartForm(i: number, form: FormDataCommon, value: RpcSerializedValue) {
  const buf = value.data[i];
  form.append(`data-${i}`, Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
}

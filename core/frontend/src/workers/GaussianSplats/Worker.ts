/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  checkGaussianSplatDecodeLimits, GaussianSplatDecodeRequest, GaussianSplatSpzRequest, spzBodyBytesPerSplat, usesCesiumIonDraftAdapter,
} from "../../internal/render/GaussianSplatData";
import { gaussianSplatError } from "../../internal/render/GaussianSplatError";
import { GaussianSplatSortRequest } from "../../internal/render/GaussianSplatSort";
import type { GaussianSplatWorkerOperations } from "../../internal/render/GaussianSplatWorker";
import { registerWorker } from "../RegisterWorker";
import { readGaussianSplatAttributes } from "./Accessors";
import { packGaussianSplats } from "./Packing";
import { sortGaussianSplats } from "./Sorting";
import { inflateSpz, SpzHeader, unpackSpz } from "./Spz";

/** The sort positions of each tile registered by the main thread, by tile id. */
const registeredPositions = new Map<number, Float32Array>();

/** How to decode and sort an SPZ payload. */
function spzConventions(header: SpzHeader, request: GaussianSplatSpzRequest) {
  if (usesCesiumIonDraftAdapter(request, header.version))
    return { coordinateSystem: "UNSPECIFIED", sortingMethod: "viewDepth" } as const;

  if (header.version !== 2)
    gaussianSplatError("KHR_gaussian_splatting_compression_spz_2 payloads must be SPZ version 2");

  return { coordinateSystem: "LUF", sortingMethod: "cameraDistance" } as const;
}

/** Reject a payload whose header does not match its request, or which is over the limits, before its body is allocated. */
function validateSpzHeader(header: SpzHeader, request: GaussianSplatSpzRequest): void {
  spzConventions(header, request);
  if (header.count !== request.count)
    gaussianSplatError("the SPZ header's splat count does not match the glTF accessors");

  const inputBytes = request.spz.byteLength + header.count * spzBodyBytesPerSplat(header.version, header.shDegree);
  checkGaussianSplatDecodeLimits(header.count, header.shDegree, inputBytes);
}

async function decodeSpz(request: GaussianSplatSpzRequest) {
  const payload = await inflateSpz(request.spz, (header) => validateSpzHeader(header, request));
  const { coordinateSystem, sortingMethod } = spzConventions(payload.header, request);
  return packGaussianSplats({ ...unpackSpz(payload, coordinateSystem), sortingMethod, colorSpace: request.colorSpace });
}

async function decode(request: GaussianSplatDecodeRequest) {
  return request.format === "spz" ? decodeSpz(request) : packGaussianSplats(readGaussianSplatAttributes(request));
}

// The main thread posts one decode at a time (see GaussianSplatDecoder), so the peaks of several decodes never add up here.
registerWorker<GaussianSplatWorkerOperations>({
  decode: async (request: GaussianSplatDecodeRequest) => {
    const decoded = await decode(request);
    return { result: decoded, transfer: [decoded.data.buffer, decoded.sh.buffer] };
  },
  register: ({ id, positions }) => {
    registeredPositions.set(id, positions);
  },
  release: (ids: number[]) => {
    for (const id of ids)
      registeredPositions.delete(id);
  },
  sort: (request: GaussianSplatSortRequest) => {
    const order = sortGaussianSplats(request, registeredPositions);
    return { result: order, transfer: [order.buffer] };
  },
});

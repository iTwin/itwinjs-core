/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Logger } from "@itwin/core-bentley";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import * as schema from "./GltfSchema";
import { Gltf } from "./GltfModel";

export interface ParseGltfLogger {
  log(message: string, type: "error" | "warning" | "info"): void;
}

export interface ParseGltfArgs {
  logger?: ParseGltfLogger;
  gltf: Uint8Array | schema.GltfDocument;
  baseUrl?: string;
  isCanceled?: boolean;
}

export async function parseGltf(args: ParseGltfArgs): Promise<Gltf.Model | undefined> {
  const parser = new GltfParser(args);
  return parser.parse();
}

class GltfParser {
  private readonly _logger: ParseGltfLogger;
  private readonly _isCanceled: () => boolean;

  public constructor(args: ParseGltfArgs) {
    this._isCanceled = () => args.isCanceled ?? false;
    this._logger = args.logger ?? {
      log: (message: string, type: "error" | "warning" | "info") => {
        const category = `${FrontendLoggerCategory.Package}.gltf`;
        const fn = type === "error" ? "logError" : (type === "warning" ? "logWarning" : "logInfo");
        Logger[fn](category, message);
      },
    }
  }

  public async parse(): Promise<Gltf.Model | undefined> {
    return undefined;
  }
}

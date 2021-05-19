/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@bentley/bentleyjs-core";

const loggerCategory = "imodel-transformer";

// if the input is not an array, wrap it in one
export function ensureArray<T extends any>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

// turn [['x', 5], ['x', 6], ['y', 10]] ==> [['x', [5, 6]], ['y', [10]]]
export function keyPairsToMultimap<K, V>(pairs: [K,V][]): Map<K,V[]> {
  const result = new Map<K, V[]>();
  for (const [k, v] of pairs) {
    if (result.get(k))
      result.get(k)!.push(v);
    else
      result.set(k, [v]);
  }
  return result;
}

// an operation for changing a schema during transformation
export interface SchemaEditOperation {
  schemaName: string;
  // regex is not powerful enough for non-trivial XML so a later update could include
  // XPATH or Jq or some other query support, but regex should be enough for current usage
  pattern: string | RegExp;
  substitution: string; // current javascript style backreferences (e.g. "hello $1")
}

export function isSchemaEditOperation(a: any): a is SchemaEditOperation {
  return typeof a === "object" && a !== null && typeof a.schemaName === "string" &&
  (typeof a.pattern === "string" || a.pattern instanceof RegExp) && typeof a.substitution === "string";
}

export function tryParseSchemaEditOperation(
  src: string
): SchemaEditOperation | undefined {
  const schemaNamePattern = /\w+/.source;
  const unescapedSlash = /(?<!\\)\//.source;
  const escapedText = /(?:[^/]|(?<=\\)\/)/.source;
  const format = RegExp(
    `(?<schemaName>${schemaNamePattern})${unescapedSlash}(?<pattern>${escapedText}+)${unescapedSlash}(?<substitution>${escapedText}*)${unescapedSlash}`,
    "g" // in the future, may allow flags to be specified after the substitution
  );
  const parseResult =
    format.exec(src)?.groups ?? ({} as Partial<Record<string, string>>);
  if (!isSchemaEditOperation(parseResult)) {
    Logger.logError(
      loggerCategory,
      `Parsing failed, source: "${src}", result: ${JSON.stringify(parseResult)}`
    );
    return undefined;
  }
  return parseResult;
}

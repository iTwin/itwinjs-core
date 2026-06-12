/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Authoring, SchemaDocument } from "./SchemaDocument";
import { SchemaIssueList } from "./SchemaIssues";

/** The EC specification (serialization format) versions a {@link SchemaDocument} can be written to
 * or read from. The in-memory document always models the latest spec; readers and writers convert
 * at the boundary. `Latest` is an alias for the newest member and moves forward with the spec.
 * @alpha
 */
export enum ECSpec {
  V3_2 = "3.2",
  /** Deliberately aliases the newest member; it advances as the spec does. */
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  Latest = "3.2",
}

/** The result every schema-document reader returns, regardless of where it reads from (XML text,
 * JSON text, an iModel). `document` is `undefined` only when the input was too broken to produce
 * one (e.g. unparseable XML); everything less severe is reported through `issues` alongside a
 * best-effort document, consistent with the validity-free stance - a readable-but-invalid schema
 * is the compiler's problem, not the reader's.
 * @alpha
 */
export interface SchemaDocumentReadResult {
  document?: SchemaDocument;
  issues: SchemaIssueList;
}

/** The identity-and-dependencies summary of a schema obtained without loading its full content:
 * name, version, alias, and the reference list. This is what schema discovery peeks out of each
 * candidate (the cheap pass over a directory or an iModel) to build the dependency graph before
 * any full document is hydrated. A fully-loaded {@link SchemaDocument} satisfies this shape, so a
 * document already in hand can stand in for its own header.
 * @alpha
 */
export interface SchemaDocumentHeader {
  readonly name: string;
  readonly readVersion: number;
  readonly writeVersion: number;
  readonly minorVersion: number;
  readonly alias?: string;
  readonly references: ReadonlyArray<Authoring.SchemaReference>;
}

/** The result of a header peek. Mirrors {@link SchemaDocumentReadResult}: `header` is `undefined`
 * only when the input was unusable.
 * @alpha
 */
export interface SchemaHeaderReadResult {
  header?: SchemaDocumentHeader;
  issues: SchemaIssueList;
}

/** The input every text reader accepts: a whole text, whole UTF-8 bytes, or an incrementally
 * produced sequence of either. The chunked form exists for large inputs - schema files reach
 * hundreds of megabytes - and lets readers consume them without ever holding the full text in
 * memory. Any `AsyncIterable` works on every platform: a Node file stream
 * (`fs.createReadStream(path)`) satisfies it directly, and a web `ReadableStream` adapts with a
 * few lines. Plain strings remain first-class for embedded schemas and tests.
 * @alpha
 */
export type SchemaText = string | Uint8Array | AsyncIterable<string | Uint8Array>;

/** Normalizes a {@link SchemaText} into string chunks, decoding bytes as UTF-8 (the encoding of
 * EC schema files). Reader implementations share this so the rest of their logic deals only in
 * strings. Lazy: chunks are pulled from the input only as the consumer iterates, and the input is
 * closed when the consumer stops early.
 * @alpha
 */
export async function* decodeSchemaText(text: SchemaText): AsyncGenerator<string> {
  if (typeof text === "string") {
    yield text;
    return;
  }
  if (text instanceof Uint8Array) {
    yield new TextDecoder().decode(text);
    return;
  }
  let decoder: TextDecoder | undefined;
  for await (const chunk of text) {
    if (typeof chunk === "string") {
      if (chunk.length > 0)
        yield chunk;
      continue;
    }
    decoder ??= new TextDecoder();
    const decoded = decoder.decode(chunk, { stream: true }); // holds back a split multi-byte sequence for the next chunk
    if (decoded.length > 0)
      yield decoded;
  }
  if (decoder !== undefined) {
    const tail = decoder.decode();
    if (tail.length > 0)
      yield tail;
  }
}

/** Parses an EC `RR.WW.mm` version string into its components, tolerating unpadded numbers.
 * Returns `undefined` when the string is not a three-part dotted number. Shared by the readers;
 * exposed for implementers of additional ones.
 * @alpha
 */
export function parseVersionString(version: string | undefined): { read: number, write: number, minor: number } | undefined {
  if (version === undefined)
    return undefined;
  const parts = version.split(".");
  if (parts.length !== 3)
    return undefined;
  const [read, write, minor] = parts.map((part) => parseInt(part, 10));
  if (isNaN(read) || isNaN(write) || isNaN(minor))
    return undefined;
  return { read, write, minor };
}

/** Rewrites the item references embedded in a presentation format override string
 * (`FormatName(precision)[UnitName|label]...`) through `mapReference`, leaving the precision
 * segment and unit labels untouched. The format name and the unit names are ordinary item
 * references, so readers normalize them to the document form and writers requalify them per
 * format (alias-qualified for ECXML, schema-qualified for ECJSON) - the same treatment every
 * other item reference gets. Tolerant: segments that do not match the grammar pass through
 * verbatim for the compiler to diagnose.
 * @alpha
 */
export function mapFormatStringReferences(formatString: string, mapReference: (reference: string) => string): string {
  const match = /^([^([]+)([\s\S]*)$/.exec(formatString);
  if (match === null)
    return formatString;
  let result = mapReference(match[1]);
  let rest = match[2];
  const precision = /^\([^)]*\)/.exec(rest);
  if (precision !== null) {
    result += precision[0];
    rest = rest.substring(precision[0].length);
  }
  for (;;) {
    const bracket = /^\[([^\]|]*)(\|[^\]]*)?\]/.exec(rest);
    if (bracket === null)
      break;
    result += `[${mapReference(bracket[1])}${bracket[2] ?? ""}]`;
    rest = rest.substring(bracket[0].length);
  }
  return result + rest;
}

/** Options shared by the text readers. */
export interface SchemaTextReadOptions {
  /** Origin of the text (file path, URL, ...), copied onto every reported issue and onto
   * {@link SchemaDocument.source} so problems stay traceable to their file. */
  source?: string;
}

/** The contract of a reader that hydrates a {@link SchemaDocument} from text in some format
 * (ECXML, ECJSON). Readers consume their input incrementally (see {@link SchemaText}): parsing a
 * chunk is synchronous work, but between chunks of a streamed input the event loop stays
 * responsive, so reading a very large file does not stall everything else. Readers for non-text
 * sources (e.g. an iModel) cannot share this exact signature, but return the same result shapes so
 * reading feels the same everywhere.
 * @alpha
 */
export interface SchemaDocumentTextReader {
  /** Reads a full document. Never throws on bad input data - problems land in the result's issues. */
  readDocument(text: SchemaText, options?: SchemaTextReadOptions): Promise<SchemaDocumentReadResult>;
  /** Reads only the header (identity + references), skipping the schema's content. Stops pulling
   * input as soon as the header is complete, so on a streamed large file only the leading
   * kilobytes are ever read; discovery calls this once per candidate. */
  readHeader(text: SchemaText, options?: SchemaTextReadOptions): Promise<SchemaHeaderReadResult>;
}

/** Options shared by the schema writers. */
export interface SchemaWriteOptions {
  /** The spec version to emit. Defaults to {@link ECSpec.Latest}. */
  spec?: ECSpec;
}

/** The result every schema writer returns. `text` is `undefined` only when the document could not
 * be written at all (e.g. an unsupported target spec); recoverable problems - an item reference
 * whose schema is missing from the reference list, say - are reported as issues alongside
 * best-effort output.
 * @alpha
 */
export interface SchemaWriteResult {
  text?: string;
  issues: SchemaIssueList;
}

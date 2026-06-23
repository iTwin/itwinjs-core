/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

/** How severe a {@link SchemaIssue} is. Only `"error"` indicates the producing operation could not
 * deliver a complete result; warnings and infos accompany an otherwise usable one.
 * @alpha
 */
export type SchemaIssueSeverity = "error" | "warning" | "info";

/** One problem found while reading, writing, resolving, or compiling schemas. Operations on
 * {@link SchemaDocument}s never throw on bad input data - they report issues and deliver as much
 * of a result as they can, leaving the caller to decide what is fatal.
 * @alpha
 */
export interface SchemaIssue {
  severity: SchemaIssueSeverity;
  /** Stable identifier of the kind of problem (e.g. `"SchemaXml-0004"`). Codes are public contract;
   * messages are not. */
  code: string;
  /** Human-readable description, with the specifics interpolated. */
  message: string;
  /** The origin the data came from, when known - a file path, URL, or source description. */
  source?: string;
  /** Path of the schema element involved, when known (e.g. `"MyDomain:Pump.SerialNumber"`). */
  location?: string;
  /** 1-based line in the source text, when the producer tracks positions (the XML reader does). */
  line?: number;
  /** 1-based column to go along with {@link line}. */
  column?: number;
}

/** An ordered collection of {@link SchemaIssue}s with convenience accessors. Producers append;
 * consumers iterate or test {@link SchemaIssueList.hasErrors}. There is deliberately no built-in
 * "throw if errors" helper - consumers decide severity policy and attach the details they need.
 * @alpha
 */
export class SchemaIssueList implements Iterable<SchemaIssue> {
  private readonly _issues: SchemaIssue[] = [];

  /** The number of issues of any severity. */
  public get size(): number {
    return this._issues.length;
  }

  /** True when at least one issue has severity `"error"`. */
  public get hasErrors(): boolean {
    return this._issues.some((issue) => issue.severity === "error");
  }

  /** The issues with severity `"error"`. */
  public get errors(): SchemaIssue[] {
    return this._issues.filter((issue) => issue.severity === "error");
  }

  /** The issues with severity `"warning"`. */
  public get warnings(): SchemaIssue[] {
    return this._issues.filter((issue) => issue.severity === "warning");
  }

  /** Iterates all issues in the order they were reported. */
  public [Symbol.iterator](): Iterator<SchemaIssue> {
    return this._issues[Symbol.iterator]();
  }

  /** Appends an issue and returns it. */
  public add(issue: SchemaIssue): SchemaIssue {
    this._issues.push(issue);
    return issue;
  }

  /** Appends every issue of another collection (e.g. merging a nested operation's results). */
  public addAll(issues: Iterable<SchemaIssue>): void {
    for (const issue of issues)
      this._issues.push(issue);
  }

  /** Shorthand for {@link add} with severity `"error"`. `details` carries the optional position fields. */
  public addError(code: string, message: string, details?: Partial<SchemaIssue>): SchemaIssue {
    return this.add({ ...details, severity: "error", code, message });
  }

  /** Shorthand for {@link add} with severity `"warning"`. */
  public addWarning(code: string, message: string, details?: Partial<SchemaIssue>): SchemaIssue {
    return this.add({ ...details, severity: "warning", code, message });
  }

  /** Shorthand for {@link add} with severity `"info"`. */
  public addInfo(code: string, message: string, details?: Partial<SchemaIssue>): SchemaIssue {
    return this.add({ ...details, severity: "info", code, message });
  }

  /** The issues as a plain array, so `JSON.stringify` renders the list transparently. */
  public toJSON(): SchemaIssue[] {
    return [...this._issues];
  }
}

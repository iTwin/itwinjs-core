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

/** Which operation produced a {@link SchemaIssue}. The subject of the problem is carried by
 * {@link SchemaIssue.name}, so a custom attribute that fails to materialize while writing ECXML is
 * group `"xml"` and name `"custom-attribute-class-unresolved"`.
 * @alpha
 */
export type SchemaIssueGroup = "xml" | "json" | "discovery" | "ec2-conversion" | "comparison" | "merge" | "validation";

/** One problem found while reading, writing, resolving, converting, or validating schemas.
 * Operations on {@link SchemaDocument}s never throw on bad input data - they report issues and
 * deliver as much of a result as they can, leaving the caller to decide what is fatal.
 * @alpha
 */
export interface SchemaIssue {
  severity: SchemaIssueSeverity;
  /** Which operation reported this. */
  group: SchemaIssueGroup;
  /** Stable kebab-case identifier of the kind of problem, unique within its group and starting with
   * the subject it is about (e.g. `"custom-attribute-class-unresolved"`). Names are public contract
   * and are what to match on; {@link SchemaIssue.message} is not contract. */
  name: string;
  /** Human-readable description, with the specifics interpolated. */
  message: string;
  /** Where the problem is, when known. Either a source position as `path:line:column` (what the
   * readers report, and what terminals turn into a clickable link) or the path of the schema element
   * involved, such as `"MyDomain:Pump.SerialNumber"`. */
  location?: string;
  /** The numbered identifier this check carries in a published rule catalog, where one exists
   * (`"ECObjects-1300"`, `"BIS-601"`, `"ECDb_0299"`). Present only so findings can be matched
   * against the older validators; {@link SchemaIssue.name} is the identity. */
  code?: string;
}

/** Formats a reader's source position as the `path:line:column` form {@link SchemaIssue.location}
 * uses, dropping the parts that are not known.
 * @alpha
 */
export function formatSourceLocation(source: string | undefined, line?: number, column?: number): string | undefined {
  const position = line === undefined ? "" : column === undefined ? `:${line}` : `:${line}:${column}`;
  if (source === undefined)
    return position === "" ? undefined : position.substring(1);
  return `${source}${position}`;
}

/** An ordered collection of {@link SchemaIssue}s with convenience accessors. Producers append;
 * consumers iterate or test {@link SchemaIssueList.hasErrors}. There is deliberately no built-in
 * "throw if errors" helper - consumers decide severity policy and attach the details they need.
 *
 * The list carries the {@link SchemaIssueGroup} of the operation that owns it, so producers name
 * their group once rather than at every call site. Issues merged in from another list keep their
 * own group.
 * @alpha
 */
export class SchemaIssueList implements Iterable<SchemaIssue> {
  private readonly _issues: SchemaIssue[] = [];

  /** The group stamped on issues this list creates. */
  public readonly group: SchemaIssueGroup;

  public constructor(group: SchemaIssueGroup) {
    this.group = group;
  }

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
  public [Symbol.iterator](): IterableIterator<SchemaIssue> {
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

  /** Shorthand for {@link add} with severity `"error"`, in this list's group. */
  public addError(name: string, message: string, location?: string, code?: string): SchemaIssue {
    return this.add({ severity: "error", group: this.group, name, message, location, code });
  }

  /** Shorthand for {@link add} with severity `"warning"`, in this list's group. */
  public addWarning(name: string, message: string, location?: string, code?: string): SchemaIssue {
    return this.add({ severity: "warning", group: this.group, name, message, location, code });
  }

  /** Shorthand for {@link add} with severity `"info"`, in this list's group. */
  public addInfo(name: string, message: string, location?: string, code?: string): SchemaIssue {
    return this.add({ severity: "info", group: this.group, name, message, location, code });
  }

  /** The issues as a plain array, so `JSON.stringify` renders the list transparently. */
  public toJSON(): SchemaIssue[] {
    return [...this._issues];
  }
}

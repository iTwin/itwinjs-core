/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import path from "path";
import { IModelJsFs } from "@itwin/core-backend";
import { BeDuration, StopWatch } from "@itwin/core-bentley";
import { Field } from "@itwin/presentation-common";

/**
 * Simplified type for `sinon.SinonSpy`.
 * @internal
 */
export type SinonSpy<T extends (...args: any) => any> = sinon.SinonSpy<Parameters<T>, ReturnType<T>>;

/** Returns field by given label. */
function tryGetFieldByLabelInternal(fields: Field[], label: string, allFields: Field[]): Field | undefined {
  for (const field of fields) {
    if (field.label === label) {
      return field;
    }

    if (field.isNestedContentField()) {
      const nestedMatchingField = tryGetFieldByLabelInternal(field.nestedFields, label, allFields);
      if (nestedMatchingField) {
        return nestedMatchingField;
      }
    }

    allFields.push(field);
  }
  return undefined;
}

/** Looks up a field by given label. Returns `undefined` if not found. */
export function tryGetFieldByLabel(fields: Field[], label: string): Field | undefined {
  return tryGetFieldByLabelInternal(fields, label, []);
}

/**
 * Returns field by given label.
 * @throws An error if the field is not found
 */
export function getFieldByLabel(fields: Field[], label: string): Field {
  const allFields = new Array<Field>();
  const result = tryGetFieldByLabelInternal(fields, label, allFields);
  if (!result) {
    throw new Error(`Field '${label}' not found. Available fields: [${allFields.map((f) => `"${f.label}"`).join(", ")}]`);
  }
  return result;
}

/**
 * Returns fields by given label.
 */
export function getFieldsByLabel(rootFields: Field[], label: string): Field[] {
  const foundFields = new Array<Field>();
  const handleFields = (fields: Field[]) => {
    for (const field of fields) {
      if (field.label === label) {
        foundFields.push(field);
      }
      if (field.isNestedContentField()) {
        handleFields(field.nestedFields);
      }
    }
  };
  handleFields(rootFields);
  return foundFields;
}
/** Get path to a directory that is safe to use for read-write scenarios when running the tests */
export function getOutputRoot() {
  return path.join("out", process.pid.toString());
}

/** Given a file name, returns a path that is safe to use for read-write scenarios when running the tests */
export function prepareOutputFilePath(fileName: string): string {
  const filePath = path.join(getOutputRoot(), fileName);
  IModelJsFs.removeSync(filePath);
  return filePath;
}

/**
 * Calls the given `check` callback until it doesn't throw or the timeout expires. The
 * timeout defaults to 5 seconds. If the callback doesn't succeed before the timeout, the
 * last error thrown by the callback is re-thrown.
 */
export async function waitFor<T>(check: () => Promise<T> | T, timeout?: number): Promise<T> {
  if (timeout === undefined) {
    timeout = 5000;
  }
  const timer = new StopWatch(undefined, true);
  let lastError: unknown;
  do {
    try {
      const res = check();
      return res instanceof Promise ? await res : res;
    } catch (e) {
      lastError = e;
      await BeDuration.wait(0);
    }
  } while (timer.current.milliseconds < timeout);
  throw lastError;
}

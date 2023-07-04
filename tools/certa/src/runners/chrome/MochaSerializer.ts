/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// NB: This file is not a CommonJs module - it needs to run in the browser. Do not import or export modules here!

// Object types we need to handle specially when serializing/deserializing
type MochaObj = Mocha.Runnable | Mocha.Suite;

/**
 * Helper for marshalling certain mocha objects between frontend and backend processes.
 *
 * Normally, playwright automatically uses JSON to serialize and deserialize arguments to backend functions exposed via `page.exposeFunction()`.
 * However, we face two problems when trying to pass `Mocha.Runnable` and `Mocha.Suite` instances to the backend:
 *   - These objects have circular references
 *   - JSON round-tripping won't preserve these objects' prototypes, and thus will be missing methods that reporters rely on.
 *
 * This class attempts to solve this by replacing all instances of these classes with "handles" that simply refer to their
 * index in a central "registry" array. Because we serialize and deserialize in the same order, we can re-create this "registry"
 * on the backend as we deserialize.
 */
class MochaSerializer {
  private static _registry: MochaObj[] = [];

  public static createHandle(raw: MochaObj, isPrimary: boolean) {
    let $$index = this._registry.indexOf(raw);
    // Browser side of mocha is webpacked so the constructor name has an added suffix for example `Test` is converted into `Test$4`.
    // This is not the case is node side of mocha, so an error is thrown because of this mismatch. The `.replace()` is there to strip that suffix
    let $$typeName: string;
    if (raw instanceof Mocha.Suite)
      $$typeName = "Suite";
    else if (raw instanceof Mocha.Test)
      $$typeName = "Test";
    else if (raw instanceof Mocha.Hook)
      $$typeName = "Hook";
    else
      throw new Error("Unexpected instance of Mocha");

    if ($$index < 0) {
      $$index = this._registry.push(raw) - 1;
      // This is a new instance, so we also need to include its properties
      isPrimary = true;
    }

    return (isPrimary) ? { $$index, $$typeName, ...raw } : { $$index, $$typeName };
  }

  /**
   * (On the frontend) Serializes a value to JSON string, recursively replacing any MochaObjs with appropriate handles
   * TODO: There are ***surely*** more performant ways to do this...
   *
   * @param root The root object to serialize.  If this is a MochaObj, it will always include all
   *             properties (even if it should already exist in the backend's registry).
   */
  public static serialize(root: any) {
    const isMochaObj = (obj: any): obj is MochaObj => (obj instanceof Mocha.Runnable || obj instanceof Mocha.Suite);

    const replacer = (key: string, value: any): any => {
      // Some pretty important properties of Errors are not enumerable, so we need to special handle them here:
      if (value instanceof Error)
        return { ...value, name: value.name, message: value.message, stack: value.stack };

      if (key === "" || !isMochaObj(value))
        return value;

      return JSON.parse(JSON.stringify(this.createHandle(value, false), replacer));
    };

    return JSON.stringify(isMochaObj(root) ? this.createHandle(root, true) : root, replacer);
  }

  /**
   * (On the backend) Deserializes a JSON string, replacing any MochaObj handles with their corresponding instances.
   * The first time we encounter a given instance's handle, we'll transform that handle object to serve as the actual instance on the backend.
   */
  public static deserialize(txt: string): any {
    return JSON.parse(txt, (_key, value) => {
      // We only need to special-case our "handle" objects, and we'll assume anything with `$$index` fits the bill.
      if (typeof value !== "object" || value === null || typeof value.$$index !== "number")
        return value;

      // Try to lookup this handle's instance in our registry
      const existing = this._registry[value.$$index];
      if (existing) {
        // Update property values (in case they've changed)
        for (const name of Object.getOwnPropertyNames(value)) {
          (existing as any)[name] = value[name];
        }
        return existing;
      }

      // Set the prototype and add the handle to the registry - we can now treat this as (essentially) the real instance.
      Object.setPrototypeOf(value, require("mocha")[value.$$typeName].prototype);
      this._registry[value.$$index] = value;
      return value;
    });
  }
}

if (typeof global !== "undefined")
  (global as any).MochaSerializer = MochaSerializer;

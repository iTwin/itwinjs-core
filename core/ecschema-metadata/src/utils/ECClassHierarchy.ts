import { SchemaItemKey } from "../SchemaKey";

interface ClassEntry {
  baseClasses: BaseClassEntry[];
  derivedClasses: SchemaItemKey[];
}

/** Interface for a Baseclass entry in the hierarchy */
interface BaseClassEntry {
  baseClassKey: SchemaItemKey;
  isMixin: boolean;
}

/**
 * The class hierarchy is a helper class that maintains the relationships between ECClasses and their base classes
 * within a SchemaContext. It allows for efficient retrieval of base and derived classes based on their schema item
 * keys to support lazy loaded classes properly.
 * @internal
 */
export class ECClassHierarchy {
  private _hierarchy = new Map<string, ClassEntry>();

  private addClassEntry(classKey: SchemaItemKey): ClassEntry {
    const classEntry: ClassEntry = { baseClasses: [], derivedClasses: [] };
    this._hierarchy.set(classKey.fullName, classEntry);
    return classEntry;
  }

  public addBaseClass(classKey: SchemaItemKey, baseClassKey: SchemaItemKey, isMixin: boolean= false): void {
    const classEntry = this._hierarchy.get(classKey.fullName) ?? this.addClassEntry(classKey);

    if(!classEntry.baseClasses.find((entry) => entry.baseClassKey.matches(baseClassKey))) {
      classEntry.baseClasses.push({ baseClassKey, isMixin });
    }

    this.addDerivedClass(baseClassKey, classKey);
  }

  private addDerivedClass(baseClassKey: SchemaItemKey, classKey: SchemaItemKey): void {
    const baseClassEntry = this._hierarchy.get(baseClassKey.fullName) ?? this.addClassEntry(baseClassKey);
    if(!baseClassEntry.derivedClasses.find((derivedKey) => derivedKey.matches(classKey))) {
      baseClassEntry.derivedClasses.push(classKey);
    }
  }

  public removeBaseClass(classKey: SchemaItemKey, baseClassKey: SchemaItemKey): void {
    const classEntry = this._hierarchy.get(classKey.fullName);
    if(!classEntry) {
      return;
    }
    const index = classEntry.baseClasses.findIndex((entry) => entry.baseClassKey.matches(baseClassKey));
    if(index !== -1) {
      classEntry.baseClasses.splice(index, 1);
    }

    this.removedDerivedClass(baseClassKey, classKey);
  }

  private removedDerivedClass(baseClassKey: SchemaItemKey, classKey: SchemaItemKey): void {
    const baseClassEntry = this._hierarchy.get(baseClassKey.fullName);
    if(!baseClassEntry) {
      return;
    }
    const derivedIndex = baseClassEntry.derivedClasses.findIndex((derivedKey) => derivedKey.matches(classKey));
    if(derivedIndex !== -1) {
      baseClassEntry.derivedClasses.splice(derivedIndex, 1);
    }
  }

  public getBaseClassKeys(classKey: SchemaItemKey): ReadonlyArray<SchemaItemKey> {
    const classEntry = this._hierarchy.get(classKey.fullName);
    if(!classEntry) {
      return [];
    }

    const baseClassKeys: SchemaItemKey[] = [];
    for (const entry of classEntry.baseClasses) {
      baseClassKeys.push(entry.baseClassKey);
      baseClassKeys.push(...this.getBaseClassKeys(entry.baseClassKey));
    }

    return baseClassKeys;
  }

  public getDerivedClassKeys(classKey: SchemaItemKey): ReadonlyArray<SchemaItemKey> {
    const classEntry = this._hierarchy.get(classKey.fullName);
    if(!classEntry) {
      return [];
    }

    const derivedClassKeys: SchemaItemKey[] = [...classEntry.derivedClasses];
    for (const derivedClassKey of classEntry.derivedClasses) {
      derivedClassKeys.push(...this.getDerivedClassKeys(derivedClassKey));
    }
    return derivedClassKeys;
  }
}

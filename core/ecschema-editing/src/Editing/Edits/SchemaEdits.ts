import type { Property, Schema, SchemaItem } from "@itwin/ecschema-metadata";
import { SchemaEditType } from "../SchemaEditType";

type SchemaEditValueType<T extends SchemaEdit> = T extends SchemaEdit<infer TValue> ? TValue : unknown;
type ApplyEditFn<TEdit extends SchemaEdit, TValue = SchemaEditValueType<TEdit>> = (value: TValue, edit: TEdit) => Promise<void>;

export interface SchemaEdit<TValue = unknown> {
  readonly type: SchemaEditType;
  readonly schema: Schema;
  readonly oldValue: TValue | undefined;
  readonly newValue: TValue | undefined;
}

export interface SchemaItemEdit<TValue = unknown> extends SchemaEdit<TValue> {
  readonly item: SchemaItem;
}

export interface SchemaPropertyEdit<TValue = unknown> extends SchemaItemEdit<TValue> {
  readonly property: Property;
}

interface SchemaEditEntry<TEdit extends SchemaEdit> {
  edit: SchemaEdit;
  set: ApplyEditFn<TEdit>;
  revert?: ApplyEditFn<TEdit>;
}

export class SchemaEditsTracker {
  private readonly _edits: SchemaEditEntry<any>[] = [];

  protected get schemaEdits(): Iterable<SchemaEdit> {
    return this._edits.map((entry) => entry.edit);
  }

  public async addEdit<T extends SchemaEdit<any>>(edit: T, set: ApplyEditFn<T>, revert?: ApplyEditFn<T>): Promise<void> {
    const entry: SchemaEditEntry<T> = {
      edit,
      set,
      revert,
    };

    await entry.set(edit.newValue, edit);
    this._edits.push(entry);
  }

  public async revertEdit(revertEntry: SchemaEdit) {
    const entryIndex = this._edits.findIndex((item) => item.edit === revertEntry);
    const entry = this._edits[entryIndex];
    if (entry === undefined) {
      throw new Error("Edit not found");
    }

    entry.revert !== undefined
      ? await entry.revert(entry.edit.oldValue, entry.edit)
      : await entry.set(entry.edit.oldValue, entry.edit);

    this._edits.splice(entryIndex, 1);
  }

  protected clearEdits() {
    this._edits.splice(0, this._edits.length);
  }
}

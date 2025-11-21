import { BeEvent } from "@itwin/core-bentley";
import { FormatDefinition, FormatsChangedArgs, FormatsProvider, MutableFormatsProvider } from "@itwin/core-quantity";
import { FormatSet } from "../Deserialization/JsonProps";
import { SchemaItem } from "../Metadata/SchemaItem";

/**
 * A mutable format provider that manages format definitions within a format set.
 * When formats are added or removed, the underlying format set is automatically updated.
 * @beta
 */
export class FormatSetFormatsProvider implements MutableFormatsProvider {
  public onFormatsChanged: BeEvent<(args: FormatsChangedArgs) => void> = new BeEvent<(args: FormatsChangedArgs) => void>();

  private _formatSet: FormatSet;
  private _fallbackProvider?: FormatsProvider;
  private _references: Map<string, string>; // Maps format name to the reference it points to

  public constructor(props: {formatSet: FormatSet, fallbackProvider?: FormatsProvider}) {
    this._formatSet = props.formatSet;
    this._fallbackProvider = props.fallbackProvider;
    this._references = new Map<string, string>();

    // Build up the map of string references
    for (const [name, format] of Object.entries(this._formatSet.formats)) {
      if (typeof format === "string") {
        this._references.set(name, format);
      }
    }
  }

  /**
   * Adds or updates the format definition returned for a kind of quantity.  Takes either a format definition or a kind of quantity full name that will be used to lookup the format that will be used.
   * @param name A kind of quantity full name used as a key to lookup this format
   * @param format The format definition or the name of a kind of quantity
   */
  public async addFormat(name: string, format: FormatDefinition | string): Promise<void> {
    this._formatSet.formats[name] = format;

    // Update the references map
    if (typeof format === "string") {
      this._references.set(name, format);
    } else {
      this._references.delete(name);
    }

    // Collect all formats that reference this format (directly or indirectly)
    const affectedFormats = this.getFormatsReferencingTarget(name);
    affectedFormats.add(name); // Include the format itself

    this.onFormatsChanged.raiseEvent({ formatsChanged: Array.from(affectedFormats) });
  }

  /**
   * Clears the fallback provider, if one is set.
   */
  public clearFallbackProvider(): void {
    this._fallbackProvider = undefined;
  }

  /**
   * Retrieves a format definition by its name from the format set. If not found, it checks the fallback provider to find the format, else returns undefined.
   * If the format is a string reference to another format, it resolves the reference and returns the FormatDefinition.
   */
  public async getFormat(input: string): Promise<FormatDefinition | undefined> {
    // Normalizes any schemaItem names coming from node addon 'schemaName:schemaItemName' -> 'schemaName.schemaItemName'
    const [schemaName, itemName] = SchemaItem.parseFullName(input);

    const name = (schemaName === "") ? itemName : `${schemaName}.${itemName}`;
    const format = this._formatSet.formats[name];

    if (format !== undefined) {
      // If format is a string reference, resolve it
      if (typeof format === "string") {
        return this.resolveReference(format);
      }
      return format;
    }

    if (this._fallbackProvider) return this._fallbackProvider.getFormat(name);
    return undefined;
  }

  /**
   * Resolves a string reference to its FormatDefinition, following chains of references.
   * @param reference The string reference to resolve
   * @param visited Set of visited references to detect circular references
   */
  private async resolveReference(reference: string, visited: Set<string> = new Set()): Promise<FormatDefinition | undefined> {
    // Prevent infinite loops from circular references
    if (visited.has(reference)) {
      return undefined;
    }
    visited.add(reference);

    const format = this._formatSet.formats[reference];

    if (format === undefined) {
      if (this._fallbackProvider) {
        return this._fallbackProvider.getFormat(reference);
      }
      return undefined;
    }

    // If we found another string reference, resolve it recursively
    if (typeof format === "string") {
      return this.resolveReference(format, visited);
    }

    return format;
  }

  /**
   * Removes a format definition or string reference from the format set.
   * @param name The name of the format to remove
   */
  public async removeFormat(name: string): Promise<void> {
    // Collect all formats that reference this format (directly or indirectly)
    const affectedFormats = this.getFormatsReferencingTarget(name);
    affectedFormats.add(name); // Include the format itself

    delete this._formatSet.formats[name];
    this._references.delete(name);

    this.onFormatsChanged.raiseEvent({ formatsChanged: Array.from(affectedFormats) });
  }

  /**
   * Gets all format names that reference the target format (directly or indirectly).
   * @param target The format name to find references to
   * @returns Set of format names that reference the target
   */
  private getFormatsReferencingTarget(target: string): Set<string> {
    const referencingFormats = new Set<string>();

    // Find all formats that directly reference the target
    for (const [formatName, reference] of this._references.entries()) {
      if (reference === target) {
        referencingFormats.add(formatName);
        // Recursively find formats that reference this format
        const indirectReferences = this.getFormatsReferencingTarget(formatName);
        for (const indirectRef of indirectReferences) {
          referencingFormats.add(indirectRef);
        }
      }
    }

    return referencingFormats;
  }
}

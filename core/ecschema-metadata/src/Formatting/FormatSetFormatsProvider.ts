import { BeEvent } from "@itwin/core-bentley";
import { FormatDefinition, FormatsChangedArgs, FormatsProvider, MutableFormatsProvider, SyncFormatsProvider, UnitSystemKey } from "@itwin/core-quantity";
import { FormatSet } from "../Deserialization/JsonProps";
import { SchemaItem } from "../Metadata/SchemaItem";

/**
 * A mutable format provider that manages format definitions within a format set.
 * When formats are added or removed, the underlying format set is automatically updated.
 * @beta
 */
export class FormatSetFormatsProvider implements MutableFormatsProvider, SyncFormatsProvider {
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
   * Retrieves a format definition from the format set, resolving string references and consulting the fallback provider when needed.
   */
  public async getFormat(input: string, system?: UnitSystemKey): Promise<FormatDefinition | undefined> {
    return this.getFormatInternal(input, system, new Set());
  }

  private async getFormatInternal(input: string, system: UnitSystemKey | undefined, providerChain: FormatSetProviderChain): Promise<FormatDefinition | undefined> {
    if (providerChain.has(this))
      return undefined;
    providerChain.add(this);

    try {
      const name = normalizeFormatName(input);
      const format = this._formatSet.formats[name];

      if (format !== undefined) {
        if (typeof format === "string") {
          const resolvedReference = await this.resolveReference(format, undefined, system, providerChain);
          return resolvedReference;
        }
        return format;
      }

      const resolvedFallback = await this.getFormatFromFallback(name, system, providerChain);
      return resolvedFallback;
    } finally {
      providerChain.delete(this);
    }
  }

  private async getFormatFromFallback(name: string, system: UnitSystemKey | undefined, providerChain: FormatSetProviderChain): Promise<FormatDefinition | undefined> {
    const fallbackProvider = this._fallbackProvider;
    if (!fallbackProvider)
      return undefined;
    if (fallbackProvider instanceof FormatSetFormatsProvider)
      return fallbackProvider.getFormatInternal(name, system, providerChain);
    return fallbackProvider.getFormat(name, system);
  }

  /**
   * Retrieves a format definition from the format set without awaiting a provider. String references are resolved
   * locally; a fallback is used only when it implements `SyncFormatsProvider`.
   */
  public getFormatSync(input: string, system?: UnitSystemKey): FormatDefinition | undefined {
    return this.getFormatSyncInternal(input, system, new Set());
  }

  private getFormatSyncInternal(input: string, system: UnitSystemKey | undefined, providerChain: FormatSetProviderChain): FormatDefinition | undefined {
    if (providerChain.has(this))
      return undefined;
    providerChain.add(this);

    try {
      const name = normalizeFormatName(input);
      const format = this._formatSet.formats[name];

      if (format !== undefined) {
        if (typeof format === "string")
          return this.resolveReferenceSync(format, undefined, system, providerChain);
        return format;
      }

      return this.getFormatSyncFromFallback(name, system, providerChain);
    } finally {
      providerChain.delete(this);
    }
  }

  private getFormatSyncFromFallback(name: string, system: UnitSystemKey | undefined, providerChain: FormatSetProviderChain): FormatDefinition | undefined {
    const fallbackProvider = this._fallbackProvider;
    if (!isSyncFormatsProvider(fallbackProvider))
      return undefined;
    if (fallbackProvider instanceof FormatSetFormatsProvider)
      return fallbackProvider.getFormatSyncInternal(name, system, providerChain);
    return fallbackProvider.getFormatSync(name, system);
  }

  /**
   * Resolves a string reference to its FormatDefinition, following chains of references.
   * @param reference The string reference to resolve
   * @param visited Set of visited references to detect circular references
   * @param system Optional unit system override
   */
  private async resolveReference(reference: string, visited: Set<string> = new Set(), system?: UnitSystemKey, providerChain: FormatSetProviderChain = new Set()): Promise<FormatDefinition | undefined> {
    // Prevent infinite loops from circular references
    if (visited.has(reference)) {
      return undefined;
    }
    visited.add(reference);

    const format = this._formatSet.formats[reference];

    if (format === undefined) {
      return this.getFormatFromFallback(reference, system, providerChain);
    }

    if (typeof format === "string") {
      return this.resolveReference(format, visited, system, providerChain);
    }

    return format;
  }

  private resolveReferenceSync(reference: string, visited: Set<string> = new Set(), system?: UnitSystemKey, providerChain: FormatSetProviderChain = new Set()): FormatDefinition | undefined {
    // Prevent infinite loops from circular references
    if (visited.has(reference)) {
      return undefined;
    }
    visited.add(reference);

    const format = this._formatSet.formats[reference];
    if (format === undefined)
      return this.getFormatSyncFromFallback(reference, system, providerChain);

    if (typeof format === "string")
      return this.resolveReferenceSync(format, visited, system, providerChain);

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

// FormatSet instances are identified by object identity in the fallback chain.
type FormatSetProviderChain = Set<FormatSetFormatsProvider>;

function normalizeFormatName(input: string): string {
  // Convert node-addon names from `schemaName:schemaItemName` to the dot-separated key used by FormatSet.
  const [schemaName, itemName] = SchemaItem.parseFullName(input);
  return schemaName === "" ? itemName : `${schemaName}.${itemName}`;
}

function isSyncFormatsProvider(provider: FormatsProvider | undefined): provider is FormatsProvider & SyncFormatsProvider {
  return provider !== undefined && "getFormatSync" in provider && typeof provider.getFormatSync === "function";
}

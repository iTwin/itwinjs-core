import { BeEvent } from "@itwin/core-bentley";
import { FormatDefinition, FormatsChangedArgs, FormatsProvider, MutableFormatsProvider } from "@itwin/core-quantity";
import { FormatSet } from "@itwin/ecschema-metadata";

export interface LocalFormatsProviderProps {
  fallbackFormatsProvider?: FormatsProvider;
  formatSet: FormatSet;
}
export class LocalFormatsProvider implements MutableFormatsProvider {
  private _fallbackFormatsProvider?: FormatsProvider;
  public onFormatsChanged = new BeEvent<(args: FormatsChangedArgs) => void>();
  private _cache: Map<string, FormatDefinition> = new Map();
  constructor(props: LocalFormatsProviderProps) {
    this._fallbackFormatsProvider = props.fallbackFormatsProvider;
    this.parseFormatSet(props.formatSet);
  }


  private parseFormatSet(formatSet: FormatSet): void {
    for (const [koqKey, format] of Object.entries(formatSet.formats)) {
      this._cache.set(koqKey, format);
    }
  }

  public async getFormat(name: string): Promise<FormatDefinition | undefined> {
    const format = this._cache.get(name);
    if (format) {
      return format;
    }
    if (this._fallbackFormatsProvider) {
      return this._fallbackFormatsProvider.getFormat(name);
    }

    return undefined;
  }

  public async addFormat(name: string, format: FormatDefinition): Promise<void> {
    this._cache.set(name, format);

    this.onFormatsChanged.raiseEvent({
      formatsChanged: [name],
    });
  }

  public async removeFormat(name: string): Promise<void> {
    this._cache.delete(name);
    this.onFormatsChanged.raiseEvent({
      formatsChanged: [name],
    });
  }
}
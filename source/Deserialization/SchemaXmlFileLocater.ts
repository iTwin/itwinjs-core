import { SchemaKey, ECVersion, Schema, SchemaMatchType, SchemaCache, ECObjectsError, ECObjectsStatus } from "../";
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

export class CandidateSchema extends Schema {
  constructor(fileName: string, searchPath: string, key: SchemaKey) {
    super(key);
    this.fileName = fileName;
    this.searchPath = searchPath;
  }
  public fileName: string;
  public searchPath: string;
}

// Temporary work around - need to add format method to string here for now....
declare global {
  interface String {
    format(...params: string[]): string;
    padStartEx(targetLength: number, padString: string): string;
  }
}
String.prototype.format = function() {
  const args = arguments;
  return this.replace(/{(\d+)}/g, (match, theNumber) => {
    return typeof args[theNumber] !== "undefined"
      ? args[theNumber]
      : match;
  });
};

// Temporary work around - need to add padStart method to string here for now...
if (!String.prototype.padStartEx) {
  String.prototype.padStartEx = function padStartEx(targetLength, padString) {
      targetLength = targetLength >> 0; // truncate if number or convert non-number to 0;
      padString = String((typeof padString !== "undefined" ? padString : " "));
      if (this.length > targetLength) {
          return String(this);
      } else {
          targetLength = targetLength - this.length;
          if (targetLength > padString.length) {
              padString += padString.repeat(targetLength / padString.length); // append to original to ensure we are longer than needed
          }
          return padString.slice(0, targetLength) + String(this);
      }
  };
}

export class SchemaXmlFileLocater {
  private _searchPaths: string[];
  private _knownSchemas: SchemaCache;

  constructor() {
    this._knownSchemas = new SchemaCache();
    this._searchPaths = [];
  }

  public addSchemaSearchPaths(schemaPaths: string[]) {
    for (const schemaPath of schemaPaths) {
      if (schemaPaths.find((entry) => entry === schemaPath))
        continue;

      this._searchPaths.push(schemaPath);
    }

    this._searchPaths.push(...schemaPaths);
  }

  public getSchema(schemaPath: string): CandidateSchema {
    const file = this.getSchemaFile(schemaPath);
    if (!file)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the schema file, ${schemaPath}`);

    const key = this._getSchemaKey(file.toString());
    const foundSchema = this._knownSchemas.getSchemaSync(key, SchemaMatchType.Exact);
    if (foundSchema)
      return foundSchema as CandidateSchema;

    // TODO - bad path
    const schema = new CandidateSchema(schemaPath, path.dirname(schemaPath), key);
    this._knownSchemas.addSchemaSync(schema);
    return schema;
  }

  public locateSchema(key: SchemaKey, matchType: SchemaMatchType): CandidateSchema | undefined {
    const foundSchema = this._knownSchemas.getSchemaSync(key, matchType);
    if (foundSchema)
      return foundSchema as CandidateSchema;

    const candidates = this.findEligibleSchemaFiles(key, matchType);
    if (!candidates || candidates.length === 0)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    this._knownSchemas.addSchemaSync(maxCandidate);
    return maxCandidate;
  }

  public getSchemaReferenceKeys(schema: CandidateSchema): SchemaKey[] {
    const file = this.getSchemaFile(schema.fileName);
    if (!file)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the schema file, ${schema.fileName}, for the schema ${schema.schemaKey.name}`);

    const keys = this._getSchemaReferenceKeys(file.toString());
    return keys;
  }

  public buildDependencyOrderedSchemaList(insertSchema: Schema, schemas?: Schema[]): Schema[] {
    if (!schemas)
      schemas = [];

    this.insertSchemaInDependencyOrderedList(schemas, insertSchema);
    for (const reference of insertSchema.references) {
      this.buildDependencyOrderedSchemaList(reference, schemas);
    }
    return schemas;
  }

  private getSchemaFile(schemaPath: string): any | undefined {
    if (!fs.existsSync(schemaPath))
      return undefined;

    return fs.readFileSync(schemaPath);
  }

  private directlyReferences(schema: Schema, possiblyReferencedSchema: Schema): boolean {
    for (const reference of schema.references) {
      if (reference === possiblyReferencedSchema)
        return true;
    }

    return false;
  }

  private dependsOn(schema: Schema, possibleDependency: Schema): boolean {
    if (this.directlyReferences(schema, possibleDependency))
        return true;

    // Possible SupplementalSchema support?
    // ...
    return false;
  }

  private insertSchemaInDependencyOrderedList(schemas: Schema[], insertSchema: Schema) {
    if (schemas.includes(insertSchema))
      return;

    for (let i = schemas.length - 1; i >= 0; --i) {
      const schema = schemas[i];
      if (this.dependsOn(insertSchema, schema)) {
        // insert right after the referenced schema in the list
        const index = schemas.indexOf(schema);
        schemas.splice(index + 1, 0, insertSchema);
        return;
      }
    }

    schemas.splice(0, 0, insertSchema);
  }

  private _getSchemaKey(data: string): SchemaKey {
    const matches = data.match(/<ECSchema ([^]+?)>/g);
    if (!matches || matches.length !== 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find '<ECSchema>' tag in the given file`);

    const name = matches[0].match(/schemaName="(.+?)"/);
    const version = matches[0].match(/version="(.+?)"/);
    if (!name || name.length !== 2 || !version || version.length !== 2)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find the ECSchema 'schemaName' or 'version' tag in the given file`);

    const key = new SchemaKey(name[1], ECVersion.fromString(version[1]));
    return key;
  }

  private _getSchemaReferenceKeys(data: string): SchemaKey[] {
    const keys: SchemaKey[] = [];
    const matches = data.match(/<ECSchemaReference ([^]+?)\/>/g);
    if (!matches)
      return keys;

    for (const match of matches) {
      const name = match.match(/name="(.+?)"/);
      const versionMatch = match.match(/version="(.+?)"/);
      if (!name || name.length !== 2 || !versionMatch || versionMatch.length !== 2)
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Invalid ECSchemaReference xml encountered in the schema file`);

      // minor version maybe missing, so add "0"
      let versionString = versionMatch[1];
      const versionParts = versionString.split(".");
      if (versionParts.length === 2)
        versionParts.push("0");
      versionString = versionParts.join(".");

      const key = new SchemaKey(name[1], ECVersion.fromString(versionString));
      keys.push(key);
    }

    return keys;
  }

  private compareSchemaKeyByVersion(lhs: CandidateSchema, rhs: CandidateSchema): number {
    return lhs.schemaKey.compareByVersion(rhs.schemaKey);
  }

  private findEligibleSchemaFiles(desiredKey: SchemaKey, matchType: SchemaMatchType): CandidateSchema[] {
    const foundFiles: CandidateSchema[] = [];
    let twoVersionSuffix: string;
    let threeVersionSuffix: string;
    const readVersion = desiredKey.readVersion.toString();
    const writeVersion = desiredKey.writeVersion.toString();
    const minorVersion = desiredKey.minorVersion.toString();

    if (matchType === SchemaMatchType.Latest) {
      twoVersionSuffix = ".*.*.ecschema.xml";
      threeVersionSuffix = ".*.*.*.ecschema.xml";
    } else if (matchType === SchemaMatchType.LatestWriteCompatible) {
      twoVersionSuffix = ".{0}.*.ecschema.xml".format(readVersion.padStartEx(2, "0"));
      threeVersionSuffix = ".{0}.{1}.*.ecschema.xml".format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"));
    } else if (matchType === SchemaMatchType.LatestReadCompatible) {
      twoVersionSuffix = ".{0}.*.ecschema.xml".format(readVersion.padStartEx(2, "0"));
      threeVersionSuffix = ".{0}.*.*.ecschema.xml".format(readVersion.padStartEx(2, "0"));
    } else {
      twoVersionSuffix = ".{0}.{1}.ecschema.xml".format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"));
      threeVersionSuffix = ".{0}.{1}.{2}.ecschema.xml".format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"),
                            minorVersion.padStartEx(2, "0"));
    }

    const twoVersionExpression = desiredKey.name + twoVersionSuffix;
    const threeVersionExpression = desiredKey.name + threeVersionSuffix;

    for (const searchPath of this._searchPaths) {
      this.addCandidateNoExtSchema(foundFiles, searchPath, desiredKey.name, desiredKey, matchType);
      this.addCandidateSchemas(foundFiles, searchPath, twoVersionExpression, desiredKey, matchType);
      this.addCandidateSchemas(foundFiles, searchPath, threeVersionExpression, desiredKey, matchType);
    }

    return foundFiles;
  }

  private addCandidateSchemas(foundFiles: CandidateSchema[], schemaPath: string, fileFilter: string, desiredKey: SchemaKey, matchType: SchemaMatchType) {
    const fullPath = path.join(schemaPath, fileFilter);

    const result = new glob.GlobSync(fullPath, {sync: true});
    for (const match of result.found) {
      let fileName = path.basename(match, ".ecschema.xml");
      // TODO: should this be moved or handled elsewhere?
      // Handles two version file names - SchemaKey.parseString supports only 3 version names.
      if (/[^\d]\.\d?\d\.\d?\d$/.test(fileName))
        fileName = fileName + ".00";

      let schemaKey: SchemaKey;
      try {
        schemaKey = SchemaKey.parseString(fileName);
      } catch (e) {
        continue;
      }
      if (schemaKey.matches(desiredKey, matchType)) {
        foundFiles.push(new CandidateSchema(match, schemaPath, schemaKey));
      }
    }
  }

  private addCandidateNoExtSchema(foundFiles: CandidateSchema[], schemaPath: string, schemaName: string, desiredKey: SchemaKey, matchType: SchemaMatchType) {
    const fullPath = path.join(schemaPath, schemaName + ".ecschema.xml");
    if (!fs.existsSync(fullPath))
      return;

    const file = fs.readFileSync(fullPath);
    if (!file)
      return;

    const key = this._getSchemaKey(file.toString());
    if (key.matches(desiredKey, matchType))
      foundFiles.push(new CandidateSchema(fullPath, schemaPath, key));
  }
}

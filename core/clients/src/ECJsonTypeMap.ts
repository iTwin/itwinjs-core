/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

/**
 * Manages the mapping between TypeScript and EC Classes/Properties to transform back and forth
 * between TypeScript objects (strongly typed) and raw JSON instances. The raw JSON instances can
 * conform to one or more "application" ECSchemas.
 *
 * The mappings are setup on the TypeScript classes using class decorators: {@link ECJsonTypeMap.classToJson}
 * and TypeScript properties using property decorators: {@link ECJsonTypeMap.propertyToJson}.
 *
 * The following utility methods can then be used to convert between TypeScript and JSON:
 * {@link ECJsonTypeMap.fromJson<T>} is used to convert a JSON instance into an instance of type T.
 * {@link ECJsonTypeMap.toJson<T>} is used to convert an instance of some type T to JSON.
 * The caller passes the application as an argument to these methods to identify the schema of the
 * raw JSON that's being generated or consumed.
 *
 * #### example
 * The BriefcaseManager API requires that a briefcase be fetched from the server (based on the "wsg" ECSchema-s),
 * kept in memory as a strongly typed TypeScript object, and then saved locally in a ECDb cache (based on
 * the ECSchema in the ECDb). The JSON would need to be transformed between WSG, ECDb and in-memory TypeScript
 * objects. Listed below are:
 * 1. the EC-JSON required/sent by WSG
 * 2. the EC-JSON required/sent by ECDb
 * 3. the TypeScript instance
 * 4. the corresponding TypeScript class definition with the class and property decorators to make the required transformations.
 *
 * 1. the EC-JSON required/sent by WSG
 *     const wsgJsonForBriefcase: any = {
 *       instanceId: "5",
 *       schemaName: "iModelScope",
 *       className: "Briefcase",
 *       eTag: "87fgQrN6y3mHD6ciCsPxhCdxCxU=",
 *       properties: {
 *         FileName: "MyTestModel.bim",
 *         FileDescription: null,
 *         FileSize: "1232896",
 *         FileId: "0056da15-2009-4862-b82a-c031cb3902d8",
 *         BriefcaseId: 5,
 *         UserOwned: "efefac5b-9a57-488b-aed2-df27bffe6d78",
 *         AcquiredDate: "2017-07-04T18:08:15.77",
 *         IsReadOnly: false,
 *         },
 *       relationshipInstances: [{
 *         className: "FileAccessKey",
 *         relatedInstance: {
 *           className: "AccessKey",
 *           properties: {
 *           DownloadUrl: "https://imodelhubqasa01.blob.core.windows.net/imodelhub-5018f11f-...",
 *           },
 *         },
 *       },
 *       ],
 *     };
 *
 * 2. the EC-JSON required/sent by ECDb
 *     const ecdbJsonForBriefcase: any = {
 *       id: "1",
 *       className: "ServiceStore.LocalBriefcase",
 *       briefcaseId: 5,
 *       userId: "efefac5b-9a57-488b-aed2-df27bffe6d78",
 *       isReadOnly: false,
 *       accessMode: 0,
 *       localPathname: "d:/SomePathHere/MyTestModel.bim",
 *       lastAccessedAt: "2017-07-04T18:08:15.77",
 *     };
 *
 * 3. the TypeScript instance
 *     const briefcase: Briefcase = {
 *       id: "5",
 *       federationGuid: "5",
 *       eTag: "87fgQrN6y3mHD6ciCsPxhCdxCxU=",
 *       fileName: "MyTestModel.bim",
 *       fileDescription: null,
 *       fileSize: "1232896",
 *       fileId: "0056da15-2009-4862-b82a-c031cb3902d8",
 *       briefcaseId: 5,
 *       userId: "efefac5b-9a57-488b-aed2-df27bffe6d78",
 *       acquiredDate: "2017-07-04T18:08:15.77",
 *       isReadOnly: false,
 *       downloadUrl: "https://imodelhubqasa01.blob.core.windows.net/i...",
 *       accessMode: 0,
 *       localPathname: "%TEMP%iModeljs/imodelName/",
 *       lastAccessedAt: "2017-07-04T18:08:15.77",
 *     };
 *
 * 4. the corresponding TypeScript class definition with the class and property decorators
 *
 *     // Base class for all typed instances mapped to ECInstance-s in an ECDb
 *     export abstract class ECInstance
 *     {
 *       @ECJsonTypeMap.propertyToJson("ecdb", "id")
 *       public id: string;
 *
 *       [index: string]: any;
 *     }
 *
 *     // Base class for all typed instances mapped to ECInstance-s in both an ECDb, and the WSG repository
 *     export abstract class WsgInstance extends ECInstance
 *     {
 *       @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
 *       @ECJsonTypeMap.propertyToJson("ecdb", "instanceId")
 *       public federationGuid: string;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "eTag")
 *       public eTag?: string;
 *     }
 *
 *     // Briefcase
 *     @ECJsonTypeMap.classToJson("wsg", "iModelScope.Briefcase", { schemaPropertyName: "schemaName", classPropertyName: "className" })
 *     @ECJsonTypeMap.classToJson("ecdb", "ServiceStore.LocalBriefcase", {classKeyPropertyName: "className"})
 *     export class Briefcase extends WsgInstance
 *     {
 *       @ECJsonTypeMap.propertyToJson("wsg", "properties.FileName")
 *       public fileName: string;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "properties.FileDescription")
 *       public fileDescription: string;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "properties.FileSize")
 *       public fileSize: string;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "properties.FileId")
 *       public fileId: string;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
 *       @ECJsonTypeMap.propertyToJson("ecdb", "briefcaseId")
 *       public briefcaseId: number;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "properties.UserOwned")
 *       @ECJsonTypeMap.propertyToJson("ecdb", "userId")
 *       public userOwned: string;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "properties.AcquiredDate")
 *       public acquiredDate: string;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "properties.IsReadOnly")
 *       @ECJsonTypeMap.propertyToJson("ecdb", "isReadOnly")
 *       public isReadOnly: boolean;
 *
 *       @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FileAccessKey].relatedInstance[AccessKey].properties.DownloadUrl")
 *       public downloadUrl?: string;
 *
 *       @ECJsonTypeMap.propertyToJson("ecdb", "accessMode")
 *       public accessMode: BriefcaseAccessMode;
 *
 *       @ECJsonTypeMap.propertyToJson("ecdb", "localPathname")
 *       public localPathname: string;
 *
 *       @ECJsonTypeMap.propertyToJson("ecdb", "lastAccessedAt")
 *       public lastAccessedAt: Date;
 *     }
 */
// @todo Update example with property type conversions once that's available.

import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

export type ConstructorType = new () => any;

const loggingCategory = "ECJson";
const className = "className";

export interface ClassKeyMapInfo {
  /** The key of the JSON property that stores the schema name - e.g., set to"schemaName" in the case of JSON consumed/supplied by WSG */
  schemaPropertyName?: string;
  /** The key of the JSON property that stores the class name - e.g., set to "className" in the case of JSON consumed/supplied by WSG. */
  classPropertyName?: string;
  /** The key of the JSON property that stores the "ECClassKey" - e.g., set to "className" in the case of JSON consumed/supplied by the ECDb API */
  classKeyPropertyName?: string;
}

class PropertyEntry {
  constructor(public readonly typedPropertyName: string, public propertyAccessString: string) {
  }
}

type PropertiesByAccessString = Map<string, PropertyEntry>;

class ApplicationEntry {
  public readonly propertiesByAccessString: PropertiesByAccessString = new Map<string, PropertyEntry>();
  public classKey: string;
  public classKeyMapInfo: ClassKeyMapInfo;

  /** Constructor */
  constructor(public applicationKey: string) {
  }

  private getPropertyByAccessString(propertyAccessString: string): PropertyEntry | undefined {
    return this.propertiesByAccessString.get(propertyAccessString);
  }

  /** Adds a new entry for a mapped property */
  public addProperty(typedPropertyName: string, propertyAccessString: string): void {
    let propertyEntry = this.getPropertyByAccessString(propertyAccessString);
    if (propertyEntry) {
      const err = `The ECProperty ${propertyAccessString} has already been mapped to another TypeScript property ${propertyEntry.typedPropertyName}`;
      throw new Error(err);
    }

    propertyEntry = new PropertyEntry(typedPropertyName, propertyAccessString);
    this.propertiesByAccessString.set(propertyAccessString, propertyEntry);
  }
}

type ApplicationsByKey = Map<string, ApplicationEntry>;

/** Entry in the registry to capture the mapping between a single EC and TypeScript class */
class ClassEntry {
  public readonly typedConstructor: ConstructorType;
  public readonly baseClassEntries: ClassEntry[] = new Array<ClassEntry>();
  public readonly applicationsByKey: ApplicationsByKey = new Map<string, ApplicationEntry>();

  /** Constructor */
  constructor(typedConstructor: ConstructorType) {
    this.typedConstructor = typedConstructor;
  }

  /** Gets the application entry by the key  */
  public getApplicationByKey(applicationKey: string): ApplicationEntry | undefined {
    return this.applicationsByKey.get(applicationKey);
  }

  /** Adds a new entry for a mapped application within a class  */
  public addApplication(applicationKey: string): ApplicationEntry {
    let applicationEntry = this.getApplicationByKey(applicationKey);
    if (applicationEntry)
      throw new Error(`Internal error: Cannot add the same application twice`);

    applicationEntry = new ApplicationEntry(applicationKey);
    this.applicationsByKey.set(applicationKey, applicationEntry);
    return applicationEntry;
  }
}

type ClassesByTypedName = Map<ConstructorType, ClassEntry>;

/** Manages the mapping between TypeScript and EC Classes/Properties */
export class ECJsonTypeMap {
  private static _classesByTypedName: ClassesByTypedName = new Map<ConstructorType, ClassEntry>();

  /** Gets an existing entry for a mapped class from the name of the TypeScript class */
  private static getClassByType(typedConstructor: ConstructorType): ClassEntry | undefined {
    return ECJsonTypeMap._classesByTypedName.get(typedConstructor);
  }

  /** Recursively gathers all class entries for base classes starting with the specified class */
  private static gatherBaseClassEntries(baseClassEntries: ClassEntry[], classEntry: ClassEntry): void {
    const baseTypedConstructor: ConstructorType = Object.getPrototypeOf(classEntry.typedConstructor.prototype).constructor;
    const baseClassEntry: ClassEntry | undefined = ECJsonTypeMap.getClassByType(baseTypedConstructor);
    if (baseClassEntry) {
      baseClassEntries.push(baseClassEntry);
      this.gatherBaseClassEntries(baseClassEntries, baseClassEntry);
    }
  }

  private static addClassPlaceholder(typedConstructor: ConstructorType): ClassEntry {
    const classEntry = new ClassEntry(typedConstructor);
    ECJsonTypeMap._classesByTypedName.set(typedConstructor, classEntry);
    ECJsonTypeMap.gatherBaseClassEntries(classEntry.baseClassEntries, classEntry);
    return classEntry;
  }

  /** Adds a new entry for a mapped class */
  private static addClass(typedConstructor: ConstructorType, applicationKey: string, classKey: string, classKeyMapInfo: ClassKeyMapInfo): ClassEntry {
    if (!(classKeyMapInfo.classKeyPropertyName || (classKeyMapInfo.schemaPropertyName && classKeyMapInfo.classPropertyName)))
      throw new Error("Either classKeyPropertyName or schemaPropertyName+classPropertyName have to be supplied to identify how the class information is persisted in JSON");

    let classEntry: ClassEntry | undefined = ECJsonTypeMap.getClassByType(typedConstructor);
    if (!classEntry) {
      classEntry = this.addClassPlaceholder(typedConstructor);
    }

    let applicationEntry = classEntry.getApplicationByKey(applicationKey);
    if (!applicationEntry) {
      applicationEntry = classEntry.addApplication(applicationKey);
      // will only happen if there are no properties that are mapped to the application - otherwise the property maps will cause the application entry to be added before
    } else if (applicationEntry.classKey === classKey) {
      const err = `Duplicate classKeys ${classKey} found on TypeScript class ${typedConstructor.name} for application ${applicationKey}`;
      throw new Error(err);
    }
    applicationEntry.classKey = classKey;
    applicationEntry.classKeyMapInfo = classKeyMapInfo;

    return classEntry;
  }

  /** Adds a new entry for a mapped property */
  private static addProperty(typedPropertyName: string, typedConstructor: ConstructorType, applicationKey: string, propertyAccessString: string) {
    let classEntry: ClassEntry | undefined = ECJsonTypeMap.getClassByType(typedConstructor);
    if (!classEntry)
      classEntry = ECJsonTypeMap.addClassPlaceholder(typedConstructor);

    let applicationEntry = classEntry.getApplicationByKey(applicationKey);
    if (!applicationEntry)
      applicationEntry = classEntry.addApplication(applicationKey);

    applicationEntry.addProperty(typedPropertyName, propertyAccessString);
  }

  /** Create a typed instance from an untyped JSON ECInstance  */
  public static fromJson<T extends ECInstance>(typedConstructor: new () => T, applicationKey: string, ecJsonInstance: any): T | undefined {
    const mappedClassEntry: ClassEntry | undefined = ECJsonTypeMap.getClassByType(typedConstructor);
    if (!mappedClassEntry) {
      Logger.logError(loggingCategory, `Type ${typedConstructor.name} is not mapped to an ECClass. Supply the appropriate class decorator`);
      return undefined;
    }

    const lowCaseApplicationKey = applicationKey.toLowerCase();
    const mappedApplicationEntry: ApplicationEntry | undefined = mappedClassEntry.getApplicationByKey(lowCaseApplicationKey);
    if (!mappedApplicationEntry) {
      Logger.logError(loggingCategory, `Type ${typedConstructor.name} is not mapped for the supplied application.`);
      return undefined;
    }

    let ecJsonClassKey: string;
    if (mappedApplicationEntry.classKeyMapInfo.classKeyPropertyName)
      ecJsonClassKey = ecJsonInstance[mappedApplicationEntry.classKeyMapInfo.classKeyPropertyName];
    else if (mappedApplicationEntry.classKeyMapInfo.schemaPropertyName && mappedApplicationEntry.classKeyMapInfo.classPropertyName)
      ecJsonClassKey = ecJsonInstance[mappedApplicationEntry.classKeyMapInfo.schemaPropertyName] + "." + ecJsonInstance[mappedApplicationEntry.classKeyMapInfo.classPropertyName];
    else {
      assert(false, "Unexpected classKeyMapInfo");
      return undefined;
    }

    if (mappedApplicationEntry.classKey !== ecJsonClassKey) {
      Logger.logError(loggingCategory, `The ClassKey ${mappedApplicationEntry.classKey} was specified to map with ${typedConstructor.name}, but does not match that specified in the JSON: ${ecJsonClassKey} `);
      return undefined;
    }

    let classEntries = Array<ClassEntry>(mappedClassEntry);
    classEntries = classEntries.concat(mappedClassEntry.baseClassEntries);

    const typedInstance: T = new typedConstructor();

    classEntries.forEach((classEntry: ClassEntry) => {
      const applicationEntry = classEntry.getApplicationByKey(lowCaseApplicationKey);
      if (!applicationEntry)
        return;

      applicationEntry.propertiesByAccessString.forEach((propertyEntry: PropertyEntry, propertyAccessString: string) => {
        let ecValue: any = ecJsonInstance;

        const ecNameParts: string[] = propertyAccessString.split("."); // e.g., "relationshipInstances[HasThumbnail].relatedInstance[SmallThumbnail].instanceId"
        for (let i = 0; i < ecNameParts.length; i++) {
          const ecNameSubParts: string[] | null = ecNameParts[i].match(/[^\[\]]+/g);
          if (!ecNameSubParts || ecNameSubParts.length === 0 || ecNameSubParts.length > 2)
            return;

          const subAccessString: string = ecNameSubParts[0];
          ecValue = ecValue[subAccessString];
          if (typeof ecValue === "undefined")
            return;

          if (ecNameSubParts.length === 2 && subAccessString === "relationshipInstances" && i < ecNameParts.length - 1) {
            const nextEcNameSubParts: string[] | null = ecNameParts[i + 1].match(/[^\[\]]+/g);
            if (!nextEcNameSubParts || nextEcNameSubParts.length !== 2)
              return;

            const expectedRelationshipInstanceClass: any = ecNameSubParts[1];
            const relatedInstanceAccessString: any = nextEcNameSubParts[0];
            const expectedRelatedInstanceClass: any = nextEcNameSubParts[1];

            let arrayIndex: number = 0;
            let arrayValue: any;
            let actualRelatedInstanceClass: any;
            while (expectedRelatedInstanceClass !== actualRelatedInstanceClass) {
              arrayValue = ecValue[arrayIndex++];
              if (typeof arrayValue === "undefined")
                return;

              if (expectedRelationshipInstanceClass === arrayValue[className]) {
                const relatedInstance: any = arrayValue[relatedInstanceAccessString];
                if (relatedInstance !== "undefined")
                  actualRelatedInstanceClass = relatedInstance[className];
              }
            }

            ecValue = arrayValue[relatedInstanceAccessString];
            i++;
          }
        }
        typedInstance[propertyEntry.typedPropertyName] = ecValue;
      });
    });

    return typedInstance;
  }

  /** Create an untyped instance from a typed instance */
  public static toJson<T extends ECInstance>(applicationKey: string, typedInstance: T): any | undefined {
    const lowCaseApplicationKey = applicationKey.toLowerCase();
    const typedConstructor = Object.getPrototypeOf(typedInstance).constructor;
    const mappedClassEntry: ClassEntry | undefined = ECJsonTypeMap.getClassByType(typedConstructor);
    if (!mappedClassEntry)
      return undefined;

    const mappedApplicationEntry: ApplicationEntry | undefined = mappedClassEntry.getApplicationByKey(lowCaseApplicationKey);
    if (!mappedApplicationEntry)
      return undefined;

    const untypedInstance: any = {};

    if (mappedApplicationEntry.classKeyMapInfo.classKeyPropertyName) {
      untypedInstance[mappedApplicationEntry.classKeyMapInfo.classKeyPropertyName] = mappedApplicationEntry.classKey;
    } else if (mappedApplicationEntry.classKeyMapInfo.schemaPropertyName && mappedApplicationEntry.classKeyMapInfo.classPropertyName) {
      const classKeyParts = mappedApplicationEntry.classKey.split(".", 2);
      untypedInstance[mappedApplicationEntry.classKeyMapInfo.schemaPropertyName] = classKeyParts[0];
      untypedInstance[mappedApplicationEntry.classKeyMapInfo.classPropertyName] = classKeyParts[1];
    } else {
      assert(false, "Unexpected classKeyMapInfo");
      return undefined;
    }

    let classEntries = Array<ClassEntry>(mappedClassEntry);
    classEntries = classEntries.concat(mappedClassEntry.baseClassEntries);

    classEntries.forEach((classEntry: ClassEntry) => {
      const applicationEntry = classEntry.getApplicationByKey(lowCaseApplicationKey);
      if (!applicationEntry)
        return;

      applicationEntry.propertiesByAccessString.forEach((propertyEntry: PropertyEntry, propertyAccessString: string) => {
        const typedValue: any = typedInstance[propertyEntry.typedPropertyName];
        if (typeof typedValue === "undefined")
          return;

        const ecNameParts: string[] = propertyAccessString.split("."); // e.g., "relationshipInstances[HasThumbnail].relatedInstance[SmallThumbnail].instanceId"
        let untypedInstanceCursor: any = untypedInstance;
        ecNameParts.forEach((ecNamePart, index) => {
          const ecNameSubParts: string[] | null = ecNamePart.match(/[^\[\]]+/g);
          if (!ecNameSubParts || ecNameSubParts.length === 0 || ecNameSubParts.length > 2)
            return;

          const accessString: string = ecNameSubParts[0];
          const isLastPart: boolean = index >= ecNameParts.length - 1;

          if (ecNameSubParts.length !== 2) {
            if (!untypedInstanceCursor[accessString])
              untypedInstanceCursor[accessString] = isLastPart ? typedValue : {};
            untypedInstanceCursor = untypedInstanceCursor[accessString];
            return;
          }

          const expectedclassName: string = ecNameSubParts[1];

          if (accessString === "relationshipInstances") {
            if (!untypedInstanceCursor[accessString])
              untypedInstanceCursor[accessString] = [];

            const nextEcNameSubParts: string[] | null = ecNameParts[index + 1].match(/[^\[\]]+/g);
            if (!nextEcNameSubParts || nextEcNameSubParts.length !== 2)
              return;

            const relatedInstanceAccessString: any = nextEcNameSubParts[0];
            const expectedRelatedInstanceClass: any = nextEcNameSubParts[1];

            let relationshipCount: number = 0;
            while (untypedInstanceCursor[accessString][relationshipCount]
              && (untypedInstanceCursor[accessString][relationshipCount][className] !== expectedclassName
                || untypedInstanceCursor[accessString][relationshipCount][relatedInstanceAccessString][className] !== expectedRelatedInstanceClass)) {
              relationshipCount++;
            }

            if (!untypedInstanceCursor[accessString][relationshipCount]) {
              untypedInstanceCursor[accessString][relationshipCount] = isLastPart ? typedValue : {};
            }
            untypedInstanceCursor = untypedInstanceCursor[accessString][relationshipCount];
          } else {
            if (accessString !== "relatedInstance" || !untypedInstanceCursor[accessString]
              || (accessString === "relatedInstance" && untypedInstanceCursor[accessString][className] !== expectedclassName)) {
              untypedInstanceCursor[accessString] = isLastPart ? typedValue : {};
            }
            untypedInstanceCursor = untypedInstanceCursor[accessString];
          }

          untypedInstanceCursor[className] = expectedclassName;
        });
      });
    });

    return untypedInstance;
  }

  /**
   * Decorator function for mapping TypeScript classes to JSON
   * @param applicationKey Identifies the application for which the mapping is specified. e.g., "ecdb", "wsg", etc.
   * @param classKey Identifies the ec class backing the JSON instance. (e.g., "ServiceStore.Briefcase" (ecdb) or "iModelScope.Briefcase" (wsg))
   * @param classKeyMapInfo Information on how the class key is persisted in the JSON instance (e.g., as two properties "schemaName" and "className")
   */
  public static classToJson(applicationKey: string, classKey: string, classKeyMapInfo: ClassKeyMapInfo) {
    return (typedConstructor: ConstructorType): void => {
      ECJsonTypeMap.addClass(typedConstructor, applicationKey.toLowerCase(), classKey, classKeyMapInfo);
    };
  }

  /**
   * Decorator function for mapping typescript properties to JSON
   * @param applicationKey Identifies the application for which the mapping is specified. e.g., "ecdb", "wsg", etc.
   * @param propertyAccessString Access string for the ECProperty
   */
  public static propertyToJson(applicationKey: string, propertyAccessString: string) {
    return (object: any, propertyKey: string): void => {
      ECJsonTypeMap.addProperty(propertyKey, object.constructor as ConstructorType, applicationKey.toLowerCase(), propertyAccessString);
    };
  }
}

/** Base class for all typed instances mapped to ECInstance-s in an ECDb */
export abstract class ECInstance {
  @ECJsonTypeMap.propertyToJson("ecdb", "id")
  public ecId: string;

  [index: string]: any;
}

export type ChangeState = "new" | "modified" | "deleted";

/** Base class for all typed instances mapped to ECInstance-s in both an ECDb, and the WSG repository */
export abstract class WsgInstance extends ECInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
  @ECJsonTypeMap.propertyToJson("ecdb", "wsgId")
  public wsgId: string;

  @ECJsonTypeMap.propertyToJson("wsg", "eTag")
  @ECJsonTypeMap.propertyToJson("ecdb", "eTag")
  public eTag?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "changeState")
  public changeState?: ChangeState;
}

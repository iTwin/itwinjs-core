/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  ECClass, ECClassModifier, EntityClass, Enumeration, EnumerationProperty, Mixin, PrimitiveProperty, PrimitiveType, Schema, SchemaItem, SchemaItemType, StructClass, StructProperty,
} from "@itwin/ecschema-metadata";

interface TsBentleyModule {
  moduleName: string;
  resolvedConflictName: string;
}

const customHandledPropertyCA: string = "BisCore.CustomHandledProperty";
const elementECClassName: string = "BisCore.Element";
const tsBentleyModules: { [index: string]: TsBentleyModule } = {
  tsIModelJsCommon: {
    moduleName: "@itwin/core-common",
    resolvedConflictName: "BeIModelJsCommon",
  },
  tsIModelJsBackend: {
    moduleName: "@itwin/core-backend",
    resolvedConflictName: "BeIModelJsBackend",
  },
  tsGeometryCore: {
    moduleName: "@itwin/core-geometry",
    resolvedConflictName: "BeGeometryCore",
  },
  tsBentleyJsCore: {
    moduleName: "@itwin/core-bentley",
    resolvedConflictName: "BeBentleyJsCore",
  },
};

/**
 * @beta
 */
export class ECSchemaToTs {
  private _tsBentleyModuleNames: Set<string>;
  private _tsBentleyModuleResolvedConflictNames: Map<string, string>;
  private _schema?: Schema;
  private _schemaItemList: SchemaItem[];

  public constructor() {
    this._schema = undefined;
    this._schemaItemList = [];

    this._tsBentleyModuleNames = new Set<string>();
    this._tsBentleyModuleResolvedConflictNames = new Map<string, string>();
    for (const key in tsBentleyModules) {
      if (tsBentleyModules.hasOwnProperty(key)) {
        const moduleName: string = tsBentleyModules[key].moduleName;
        const resolvedPrefix: string = tsBentleyModules[key].resolvedConflictName;
        this._tsBentleyModuleNames.add(moduleName);
        this._tsBentleyModuleResolvedConflictNames.set(moduleName, resolvedPrefix);
      }
    }
  }

  /**
   * Given the schema, the function will converted it to typescript strings
   * @param schema The schema to be converted to typescript strings
   */
  public convertSchemaToTs(schema: Schema): { schemaTsString: string, elemTsString: string, propsTsString: string } {
    // convert schema to typescript String
    this._schema = schema;
    this.dependencyToFront();
    const schemaTsString = this.convertSchemaToTsClass();
    const elemTsString = this.convertElemToTsClasses();
    const propsTsString = this.convertPropsToTsInterfaces();

    return { schemaTsString, elemTsString, propsTsString };
  }

  /**
   * The function will push all the base classes to be the first ones in the schema item list.
   * For example, if class A extends base class B and base class C, B and C will be on the first of the list and then A at the end.
   * If B extends C, then B will be first and C will be next in the list and then A at the end.
   * If B and C does not depend on each other, the order of B and C will not be important.
   * The arrangement is to make sure that base class will be converted first and then, derived classes and so on
   */
  private dependencyToFront(): void {
    const uniqueItemName: Set<string> = new Set<string>();
    const schemaItemsList: SchemaItem[] = [];
    for (const schemaItem of this._schema!.getItems()) {
      // base class to the item list first;
      switch (schemaItem.schemaItemType) {
        case SchemaItemType.StructClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.EntityClass:
          const ecClass = schemaItem as ECClass;
          const baseList = this.getAllBaseClasses(ecClass);
          for (let i = baseList.length - 1; i >= 0; --i) {
            const base = baseList[i];
            if (base.schema.schemaKey.compareByName(this._schema!.schemaKey) && !uniqueItemName.has(base.name)) {
              schemaItemsList.push(baseList[i]);
              uniqueItemName.add(base.name);
            }
          }
          break;
        default:
          break;
      }

      if (!uniqueItemName.has(schemaItem.name)) {
        uniqueItemName.add(schemaItem.name);
        schemaItemsList.push(schemaItem);
      }
    }

    this._schemaItemList = schemaItemsList;
  }

  /**
   * The function converts the schema meta data to typescript Schema class
   */
  private convertSchemaToTsClass(): string {
    const schemaName = this._schema!.schemaKey.name;
    let outputString: string = "";

    // import modules
    outputString += "import { ClassRegistry, Schema, Schemas } from \"@itwin/core-backend\";\n";
    outputString += `import * as elementsModule from "./${schemaName}Elements";\n\n`;

    // create new schema class
    outputString += `export class ${schemaName} extends Schema {\n`;

    // schemaName() method
    outputString += `  public static get schemaName(): string { return "${schemaName}"; }\n\n`;

    // registerSchema method
    outputString += "  public static registerSchema() {\n";
    outputString += `    if (!Schemas.getRegisteredSchema(${schemaName}.name))\n`;
    outputString += `      Schemas.registerSchema(${schemaName});\n`;
    outputString += "  }\n\n";

    // constructor
    outputString += "  protected constructor() {\n";
    outputString += "    super();\n";
    outputString += `    ClassRegistry.registerModule(elementsModule, ${schemaName});\n`;
    outputString += "  }\n";

    outputString += "}\n\n";

    return outputString;
  }

  /**
   * The function converts the schema item to respective typescript classes
   */
  private convertElemToTsClasses(): string {
    const classNameToModule: Map<string, string> = new Map<string, string>();
    let classTs: string = "";
    for (const schemaItem of this._schemaItemList) {
      switch (schemaItem.schemaItemType) {
        case SchemaItemType.EntityClass:
          classTs += this.convertEntityToTs(schemaItem as EntityClass, classNameToModule);
          break;
        case SchemaItemType.Enumeration:
          classTs += this.convertEnumToTs(schemaItem as Enumeration);
          break;
        default:
          continue;
      }
    }

    let outputString: string = this.convertImportToTsImport(classNameToModule);
    outputString += `\n${classTs}`;
    return outputString;
  }

  /**
   * The function converts the schema item properties to respective typescript props interfaces
   */
  private convertPropsToTsInterfaces(): string {
    const classNameToModule: Map<string, string> = new Map<string, string>();
    let interfacesTs: string = "";
    for (const schemaItem of this._schemaItemList) {
      switch (schemaItem.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
          interfacesTs += this.convertECClassPropsToTsInterface(schemaItem as (Mixin | StructClass | EntityClass), classNameToModule);
          break;
        default:
          continue;
      }
    }

    let outputString: string = this.convertImportToTsImport(classNameToModule);
    outputString += `\n${interfacesTs}`;
    return outputString;
  }

  /**
   * Convert mixin or struct class or entity class to respective typescript interface
   * @param ecClass Schema mixin or struct or entity to be converted typescript interface
   * @param classNameToModule Typescrip modules to be updated after the conversion
   */
  private convertECClassPropsToTsInterface(ecClass: Mixin | StructClass | EntityClass, classNameToModule: Map<string, string>): string {
    let interfacesTs: string = "";

    // no interface props for BisCore Element
    if (ecClass.fullName === elementECClassName)
      return interfacesTs;

    // only generate props interface for entity if the class has properties
    if (ecClass.schemaItemType === SchemaItemType.EntityClass && (!ecClass.properties || ecClass.properties.next().done))
      return interfacesTs;

    // convert description to typescript comment only for mixin or struct
    if (ecClass.schemaItemType !== SchemaItemType.EntityClass && ecClass.description)
      interfacesTs += `${this.convertDescriptionToTsComment(ecClass.description)}\n`;

    // build interface for props in ecClass
    interfacesTs += `export interface ${ecClass.name}`;
    if (ecClass.schemaItemType === SchemaItemType.EntityClass)
      interfacesTs += "Props";

    // Extend it with base ecClass Props interface if there is any
    const baseClasses = this.getBaseClassWithProps(ecClass);
    if (baseClasses.length > 0) {
      interfacesTs += " extends ";

      let separator = "";
      for (const base of baseClasses) {
        interfacesTs += separator + this.addImportBasePropsClass(classNameToModule, base, ecClass);
        separator = ", ";
      }
    } else if (ecClass.schemaItemType === SchemaItemType.EntityClass)
      interfacesTs += ` extends ${this.addImportClass(classNameToModule, tsBentleyModules.tsIModelJsCommon.moduleName, "EntityProps")}`;

    // build props for ecClass
    interfacesTs += " {";
    const propertiesTs = this.convertPropsToTsVars(ecClass, classNameToModule);
    for (const varDeclarationLine of propertiesTs)
      interfacesTs += `\n  ${varDeclarationLine}`;
    interfacesTs += "\n}\n\n";

    return interfacesTs;
  }

  /**
   * Convert schema enumeration to typescript enumeration
   * @param ecEnum Schema enumeration to be converted to typescript enumeration
   */
  private convertEnumToTs(ecEnum: Enumeration): string {
    let outputString: string = "";
    if (ecEnum.description)
      outputString += `${this.convertDescriptionToTsComment(ecEnum.description)}\n`;

    outputString += `export const enum ${ecEnum.name} {\n`;
    for (const ecEnumerator of ecEnum.enumerators) {
      outputString += `  ${ecEnumerator.label}`;
      if (ecEnum.isInt)
        outputString += ` = ${ecEnumerator.value}`;
      else if (ecEnum.isString)
        outputString += ` = "${ecEnumerator.value}"`;
      outputString += ",\n";
    }

    outputString += "}\n\n";
    return outputString;
  }

  /**
   * Convert schema entity to typescript entity class. The typescript class will implement respective props
   * typescript interface if the schema entity class has properties
   * @param ecClass Schema class to be converted to typescript class
   * @param classNameToModule Typescrip modules to be updated after the conversion
   */
  private convertEntityToTs(ecClass: EntityClass, classNameToModule: Map<string, string>): string {
    let outputString: string = "";
    if (ecClass.description)
      outputString += `${this.convertDescriptionToTsComment(ecClass.description)}\n`;

    let modifier: string = "";
    if (ecClass.modifier === ECClassModifier.Abstract)
      modifier = "abstract ";
    outputString += `export ${modifier}class ${ecClass.name} extends `;

    // extend base class if there is any. Default will be Entity class defined in @itwin/core-backend
    const base = ecClass.getBaseClassSync();
    if (base)
      outputString += this.addImportBaseClass(classNameToModule, base, ecClass);
    else
      outputString += this.addImportClass(classNameToModule, tsBentleyModules.tsIModelJsBackend.moduleName, "Entity");

    // determine prop type to pass in the constructor
    let propsBaseTsType: string;
    const propsBase = this.getBaseClassWithProps(ecClass);
    if (ecClass.fullName !== elementECClassName && ecClass.properties && !ecClass.properties.next().done) {
      const moduleName: string = `${this._schema!.schemaKey.name}ElementProps`;
      propsBaseTsType = this.addImportClass(classNameToModule, moduleName, `${ecClass.name}Props`);
    } else if (propsBase.length > 0)
      propsBaseTsType = this.addImportBasePropsClass(classNameToModule, propsBase[0], ecClass);
    else
      propsBaseTsType = this.addImportClass(classNameToModule, tsBentleyModules.tsIModelJsCommon.moduleName, "EntityProps");

    // implement the ecClass props if it has properties
    if (`${ecClass.name}Props` === propsBaseTsType)
      outputString += ` implements ${propsBaseTsType}`;

    // write constructor and className function for class
    const iModelDbTsType: string = this.addImportClass(classNameToModule, tsBentleyModules.tsIModelJsBackend.moduleName, "IModelDb");

    outputString += " {\n";
    outputString += `  public static get className(): string { return "${ecClass.name}"; }\n\n`;
    outputString += `  public constructor (props: ${propsBaseTsType}, iModel: ${iModelDbTsType}) {\n`;
    outputString += "    super(props, iModel);\n";
    outputString += "  }\n";
    outputString += "}\n\n";

    return outputString;
  }

  /**
   * Convert class properties to typescript member declaration
   * @param ecClass The schema class that has the properties to be converted to typescript member variables
   * @param classNameToModule Typescrip modules to be updated after the conversion
   */
  private convertPropsToTsVars(ecClass: ECClass, classNameToModule: Map<string, string>): string[] {
    if (ecClass.properties === undefined || ecClass.properties.next().done)
      return [];

    const outputStrings: string[] = [];
    for (const ecProperty of ecClass.properties) {
      // not generate ts variable declaration for property that has CustomHandledProperty ca
      if (ecProperty.customAttributes && ecProperty.customAttributes.has(customHandledPropertyCA))
        continue;

      let varDeclarationLine: string = `${this.lowerPropertyName(ecProperty.name)}?: `;
      if (ecProperty.isPrimitive()) {
        // determine Ts type of the primitive
        let typeTs: string = "";
        if (ecProperty.extendedTypeName)
          typeTs = this.convertExtendedTypeNameToTsType(ecProperty.extendedTypeName, classNameToModule);
        else if (ecProperty.isEnumeration()) {
          const ecEnumProperty = ecProperty as EnumerationProperty;
          const ecEnum = ecEnumProperty.enumeration!;
          typeTs = this.addImportClass(classNameToModule, `${ecEnum.schemaKey.name}Elements`, ecEnum.name);
        } else {
          const ecPrimitiveProperty = ecProperty as PrimitiveProperty;
          typeTs = this.convertPrimitiveTypeToTsType(ecPrimitiveProperty.primitiveType, classNameToModule);
        }

        varDeclarationLine += typeTs;
      } else if (ecProperty.isStruct()) {
        // import struct class if it is in different schema
        const ecStructProperty = ecProperty as StructProperty;
        const structClass = ecStructProperty.structClass;
        if (!structClass.schema.schemaKey.compareByName(ecClass.schema.schemaKey))
          varDeclarationLine += this.addImportClass(classNameToModule, `${structClass.schema.schemaKey.name}ElementProps`, structClass.name);
        else
          varDeclarationLine += structClass.name;

      } else if (ecProperty.isNavigation())
        varDeclarationLine += this.addImportClass(classNameToModule, tsBentleyModules.tsIModelJsCommon.moduleName, "RelatedElementProps");

      if (ecProperty.isArray())
        varDeclarationLine += "[]";
      varDeclarationLine += ";";

      outputStrings.push(varDeclarationLine);
    }

    return outputStrings;
  }

  /**
   * Convert schema extended type to typescript type
   * @param typeName Schema extended type to be converted to typescript type
   * @param classNameToModule Typescrip modules to be updated after the conversion
   */
  private convertExtendedTypeNameToTsType(typeName: string, classNameToModule: Map<string, string>): string {
    switch (typeName) {
      case "Json":
        return "any";
      case "BeGuid":
        return this.addImportClass(classNameToModule, tsBentleyModules.tsBentleyJsCore.moduleName, "GuidString");
      default:
        return "any";
    }
  }

  /**
   * Convert schema primitive type to typescript type
   * @param type Schema primitive type to be converted to typescript type
   * @param classNameToModule Typescrip modules to be updated after the conversion
   */
  private convertPrimitiveTypeToTsType(type: PrimitiveType, classNameToModule: Map<string, string>) {
    switch (type) {
      case PrimitiveType.Binary:
        return "any";
      case PrimitiveType.Boolean:
        return "boolean";
      case PrimitiveType.DateTime:
        return "Date";
      case PrimitiveType.Double:
        return "number";
      case PrimitiveType.Integer:
        return "number";
      case PrimitiveType.Long:
        // eslint-disable-next-line no-console
        console.log("Primitive type Long is not currently supported during conversion. It will be treated as type 'any'");
        return "any";
      case PrimitiveType.String:
        return "string";
      case PrimitiveType.Point2d:
        return this.addImportClass(classNameToModule, tsBentleyModules.tsGeometryCore.moduleName, "Point2d");
      case PrimitiveType.Point3d:
        return this.addImportClass(classNameToModule, tsBentleyModules.tsGeometryCore.moduleName, "Point3d");
      case PrimitiveType.IGeometry:
        // eslint-disable-next-line no-console
        console.log("Primitive type IGeometry is not currently supported during conversion. It will be treated as type 'any'");
        return "any";
      default:
        // eslint-disable-next-line no-console
        console.log("Unknown primitive type during conversion. It will be treated as type 'any'");
        return "any";
    }
  }

  /**
   * Convert schema description to typescript comment
   * @param description Schema description to be converted to typescript comment
   */
  private convertDescriptionToTsComment(description: string) {
    let outputString: string = "/**\n";

    let wordCount: number = 0;
    let begin: number = 0;
    let spaceBegin: number = 0;
    let spaceIdx: number = description.indexOf(" ", spaceBegin);
    while (spaceIdx !== -1) {
      // new line for every 20 words
      ++wordCount;
      if (wordCount === 20) {
        wordCount = 0;
        outputString += ` * ${description.substr(begin, spaceIdx - begin)}\n`;
        begin = spaceIdx + 1;
      }

      spaceBegin = spaceIdx + 1;
      while (description[spaceBegin] === " ")
        ++spaceBegin;

      spaceIdx = description.indexOf(" ", spaceBegin);
    }

    // append the last word
    outputString += ` * ${description.substr(begin)}\n`;

    outputString += " */";
    return outputString;
  }

  /**
   * Convert all modules needed for the converted schema types to typescript import statements
   * @param classNameToModule Modules to be converted to typescript imports statement
   */
  private convertImportToTsImport(classNameToModule: Map<string, string>): string {
    const moduleToTsTypes: Map<string, Set<string>> = new Map<string, Set<string>>();
    classNameToModule.forEach((moduleNames: string, className: string) => {
      if (!moduleToTsTypes.has(moduleNames))
        moduleToTsTypes.set(moduleNames, new Set<string>());

      moduleToTsTypes.get(moduleNames)!.add(className);
    });

    let outputString: string = "";
    moduleToTsTypes.forEach((classNames: Set<string>, moduleName: string) => {
      if (!this._tsBentleyModuleNames.has(moduleName))
        moduleName = `./${moduleName}`;

      outputString += "import { ";
      let separator = "";
      for (const className of classNames) {
        outputString += separator + className;
        separator = ", ";
      }
      outputString += ` } from "${moduleName}";\n`;
    });

    return outputString;
  }

  /**
   * Traverse the inheritance tree to retrieve first base classes that have properties
   * @param ecClass Schema class to be traverse
   */
  private getBaseClassWithProps(ecClass: ECClass): ECClass[] {
    const res: ECClass[] = [];
    const visited: Set<string> = new Set<string>();
    visited.add(ecClass.fullName);
    this.traverseBaseClass(ecClass, visited, (base: ECClass) => {
      if (base.properties && !base.properties.next().done) {
        res.push(base);
        return false;
      }

      return true;
    });

    return res;
  }

  /**
   * Traverse the inheritance tree to retrieve base classes of a schema class
   * @param ecClass Schema class to be traverse
   */
  private getAllBaseClasses(ecClass: ECClass): ECClass[] {
    const res: ECClass[] = [];
    const visited: Set<string> = new Set<string>();
    visited.add(ecClass.fullName);
    this.traverseBaseClass(ecClass, visited, (base: ECClass) => {
      res.push(base);
      return true;
    });

    return res;
  }

  /**
   * Traverse the inheritance tree horizontally and vertically of a schema class
   * @param ecClass Schema class to be traverse
   * @param visited Set of classes that are already visited
   * @param shouldTraverseDown Lambda to determine if it should traverse more vertically
   */
  private traverseBaseClass(ecClass: ECClass, visited: Set<string>, shouldTraverseDown: (base: ECClass) => boolean): void {
    const base = ecClass.getBaseClassSync();
    if (base === undefined || visited.has(base.fullName))
      return;

    const baseList: ECClass[] = [base];
    if (ecClass.schemaItemType === SchemaItemType.EntityClass) {
      const entity = ecClass as EntityClass;
      for (const mixin of entity.getMixinsSync())
        baseList.push(mixin);
    }

    for (const eachBase of baseList) {
      visited.add(eachBase.fullName);
      if (shouldTraverseDown(eachBase))
        this.traverseBaseClass(eachBase, visited, shouldTraverseDown);
    }
  }

  /**
   * Add required typescript class that is to be imported from a required module during Schema conversion to typescript. If there is naming conflict
   * it will resolve it by appending prefix name with class name, for example: import { element as BisCoreElement } from "BisCoreElement";
   * @param classNameToModule Typescript modules that is needed for the conversion. It maps typescript class with the required modules
   * @param refModule Typescript module that the typescrip class comes from
   * @param className Required Typescript class for the conversion
   */
  private addImportClass(classNameToModule: Map<string, string>, refModule: string, className: string): string {
    if (!classNameToModule.has(className)) {
      classNameToModule.set(className, refModule);
      return className;
    }

    if (classNameToModule.get(className) === refModule)
      return className;

    let resolvedPrefix: string = refModule;
    if (this._tsBentleyModuleResolvedConflictNames.has(refModule))
      resolvedPrefix = this._tsBentleyModuleResolvedConflictNames.get(refModule)!;

    const renameClassName = `${className} as ${resolvedPrefix}${className}`;
    if (!classNameToModule.has(renameClassName)) {
      classNameToModule.set(renameClassName, refModule);
    }

    return resolvedPrefix + className;
  }

  /**
   * Add appropriate typescript props interface to the classNameToModule and return the corresponding typescript base props interface
   * @param classNameToModule Typescript modules that is needed for the conversion. It maps typescript class with the required modules
   * @param baseECClass Base class of ecClass that has properties. Its name will be used to derived typescript base props interface
   * @param ecClass ECClass to be converted to Typescript
   */
  private addImportBasePropsClass(classNameToModule: Map<string, string>, baseECClass: ECClass, ecClass: ECClass): string {
    let baseName: string = baseECClass.name;
    if (baseECClass.schemaItemType === SchemaItemType.EntityClass)
      baseName += "Props";

    // find external module to import
    let externalModule: string = "";
    const shouldImportJsCommon = (baseECClass.fullName === elementECClassName) ||
      (baseECClass.schema.schemaKey.name === "BisCore" && ecClass.schema.schemaKey.name !== "BisCore");
    if (shouldImportJsCommon)
      externalModule = tsBentleyModules.tsIModelJsCommon.moduleName;
    else if (!baseECClass.schema.schemaKey.compareByName(ecClass.schema.schemaKey))
      externalModule = `${baseECClass.schema.schemaKey.name}ElementProps`;

    if (externalModule.length !== 0)
      baseName = this.addImportClass(classNameToModule, externalModule, baseName);

    return baseName;
  }

  /**
   * Add appropriate typescript base class to the classNameToModule and return the corresponding typescript base class
   * @param classNameToModule Typescript modules that is needed for the conversion. It maps typescript class with the required modules
   * @param baseECClass Base class of ecClass
   * @param ecClass ECClass to be converted to Typescript
   */
  private addImportBaseClass(classNameToModule: Map<string, string>, baseECClass: ECClass, ecClass: ECClass): string {
    let baseName: string = baseECClass.name;

    // find external module to import for base class
    let externalModule: string = "";
    if (baseECClass.schema.schemaKey.name === "BisCore" && ecClass.schema.schemaKey.name !== "BisCore")
      externalModule = tsBentleyModules.tsIModelJsBackend.moduleName;
    else if (!baseECClass.schema.schemaKey.compareByName(ecClass.schema.schemaKey))
      externalModule = `${baseECClass.schema.schemaKey.name}Elements`;

    if (externalModule.length !== 0)
      baseName = this.addImportClass(classNameToModule, externalModule, baseName);

    return baseName;
  }

  /**
   * Lower the first character of the property name
   * @param propName Property name
   */
  private lowerPropertyName(propName: string): string {
    return propName.charAt(0).toLowerCase() + propName.slice(1);
  }
}

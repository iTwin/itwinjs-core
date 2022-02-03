/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import type { ECSqlStatement, IModelDb} from "@itwin/core-backend";
import { IModelJsFs, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelTestUtils } from "@itwin/core-backend/lib/cjs/test/index";
import type { Id64String } from "@itwin/core-bentley";
import type { GeometricElementProps, GeometryStreamProps} from "@itwin/core-common";
import {
  BriefcaseIdValue, Code, ColorDef, DbResult, IModel, SubCategoryAppearance,
} from "@itwin/core-common";
import { Arc3d, IModelJson as GeomJson, Point2d, Point3d } from "@itwin/core-geometry";

export class PerfTestDataMgr {
  public db: SnapshotDb | undefined;
  public modelId: any;
  public catId: any;

  public constructor(imodelPath: string, createNew: boolean = false) {
    if (createNew) {
      if (IModelJsFs.existsSync(imodelPath))
        IModelJsFs.removeSync(imodelPath);
    }
    const fName = path.basename(imodelPath);
    const dirName = path.basename(path.dirname(imodelPath));
    this.db = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile(dirName, fName), { rootSubject: { name: "PerfTest" } });
  }
  public async importSchema(schemaPath: string, testCName: string = "") {
    assert(IModelJsFs.existsSync(schemaPath));
    if (this.db) {
      await this.db.importSchemas([schemaPath]);
      if (testCName)
        assert.isDefined(this.db.getMetaData(testCName), `Class Name ${testCName}is not present in iModel.`);
      this.db.saveChanges();
    }
  }
  public setup() {
    if (this.db) {
      this.modelId = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(this.db, Code.createEmpty(), true);
      this.catId = SpatialCategory.queryCategoryIdByName(this.db, IModel.dictionaryId, "MySpatialCategory");
      if (undefined === this.catId) {
        this.catId = SpatialCategory.insert(this.db, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
      }
      this.db.nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
      this.db.saveChanges();
    }
  }
  public closeDb() {
    if (this.db)
      this.db.close();
  }
}

const values: any = {
  baseStr: "PerfElement - InitValue", sub1Str: "PerfElementSub1 - InitValue",
  sub2Str: "PerfElementSub2 - InitValue", sub3Str: "PerfElementSub3 - InitValue",
  baseLong: "0x989680", sub1Long: "0x1312d00", sub2Long: "0x1c9c380", sub3Long: "0x2625a00",
  baseDouble: -3.1416, sub1Double: 2.71828, sub2Double: 1.414121, sub3Double: 1.61803398874,
};

function camelize(text: string) {
  text = text.replace(/[-_\s.]+(.)?/g, (_, c) => c ? c.toUpperCase() : "");
  return text.substr(0, 1).toLowerCase() + text.substr(1);
}

function genPropValue(prop: string): any {
  if (prop.toLowerCase().includes("string"))
    return "Test Value";
  if (prop.toLowerCase().includes("double"))
    return 4.25658;
  if (prop.toLowerCase().includes("long"))
    return 30486025;
  if (prop.toLowerCase().includes("int"))
    return 12;
  if (prop.toLowerCase().includes("datetime"))
    return "2020-01-01T00:00:00.000";
  if (prop.toLowerCase().includes("boolean"))
    return true;
  if (prop.toLowerCase().includes("binary"))
    return new Uint8Array([1, 2, 3]);
  if (prop.toLowerCase().includes("point2d"))
    return new Point2d(1.034, 2.034);
  if (prop.toLowerCase().includes("point3d"))
    return new Point3d(-1.0, 2.3, 3.0001);
  else // could not find type
    return undefined;
}

interface TestElementProps extends GeometricElementProps {
  baseStr?: string;
  baseLong?: number;
  baseDouble?: number;
  sub1Str?: string;
  sub2Str?: string;
  sub3Str?: string;
  sub1Long?: number;
  sub2Long?: number;
  sub3Long?: number;
  sub1Double?: number;
  sub2Double?: number;
  sub3Double?: number;
}

export class PerfTestUtility {
  public static genSchemaXML(schemaName: string, className: string, classCount: number, hierarchy: boolean, is3d: boolean, props: any[]) {
    const subClassName = `${className}Sub`;
    let sxml = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="${schemaName}" alias="tps" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>`;
    for (let i = 0; i < classCount; ++i) {
      sxml = `${sxml}
        <ECEntityClass typeName="${i === 0 ? className : subClassName + i}">`;
      const bisBaseClass: string = is3d ? "bis:PhysicalElement" : "bis:GraphicalElement2d";
      if (hierarchy) {
        let baseClass: string = "";
        if (i === 0)
          baseClass = bisBaseClass;
        else {
          baseClass = i === 1 ? className : subClassName + (i - 1);
        }
        sxml = `${sxml}
            <BaseClass>${baseClass}</BaseClass>`;
      } else {
        sxml = `${sxml}
        <BaseClass>${bisBaseClass}</BaseClass>`;
      }
      if (props.length === 0) {
        sxml = `${sxml}
            <ECProperty propertyName="${i === 0 ? "BaseStr" : `Sub${i}Str`}" typeName="string"/>
            <ECProperty propertyName="${i === 0 ? "BaseLong" : `Sub${i}Long`}" typeName="long"/>
            <ECProperty propertyName="${i === 0 ? "BaseDouble" : `Sub${i}Double`}" typeName="double"/>`;

      } else {
        for (const prop of props) {
          const propType = prop.split("Test")[0];
          sxml = `${sxml}
          <ECProperty propertyName="${i === 0 ? prop : `Sub${i}${prop}`}" typeName="${propType}"/>`;
        }
      }
      sxml = `${sxml}
        </ECEntityClass>`;
    }
    sxml = `${sxml}
    </ECSchema>`;
    return sxml;
  }
  public static genPropValues(imodel: IModelDb, schemaName: string, className: string): any {
    const props: string[] = [];
    const ecsql: string = `SELECT DISTINCT prop.Name FROM ECDbMeta.ECPropertyDef prop
       JOIN ECDbMeta.ECClassDef base ON base.ECInstanceId = prop.Class.Id
       JOIN ECDbMeta.ECSchemaDef schema ON schema.ECInstanceId = base.Schema.Id
       JOIN ECDbMeta.ClassHasAllBaseClasses abc ON abc.TargetECInstanceId = base.ECInstanceId
       WHERE (prop.Class.id = ec_classid('${schemaName}', '${className}'))
        OR (
       abc.SourceECInstanceId = ec_classid('${schemaName}', '${className}')
       AND abc.TargetECInstanceId != ec_classid('${schemaName}', '${className}')
       AND schema.Name != 'BisCore')`;

    imodel.withPreparedStatement(ecsql, (stmt: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        props.push(stmt.getRow().name);
      }
    });
    const vals: any = {};
    // first fill with defined data that has been used for a while
    for (const prop of props) {
      const camelProp = camelize(prop);
      if (camelProp in values) {
        vals[camelProp] = values[camelProp];
      } else {
        vals[camelProp] = genPropValue(camelProp);
      }
    }
    return vals;
  }

  public static initElemProps(classFullName: string, _iModelName: IModelDb, modId: Id64String, catId: Id64String): GeometricElementProps {
    const classParts = classFullName.split(":");
    const schemaName: string = classParts[0];
    const className: string = classParts[1];
    // add Geometry
    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];
    const geometryStream: GeometryStreamProps = [];
    for (const geom of geomArray) {
      const arcData = GeomJson.Writer.toIModelJson(geom);
      geometryStream.push(arcData);
    }
    // Create props
    const elementProps: GeometricElementProps = {
      classFullName: `${schemaName}:${className}`,
      model: modId,
      category: catId,
      code: Code.createEmpty(),
      geom: geometryStream,
    };

    const autoHandledProps = PerfTestUtility.genPropValues(_iModelName, schemaName, className);
    Object.assign(elementProps, autoHandledProps);

    return elementProps;
  }

  public static getCount(imodel: IModelDb, className: string) {
    let count = 0;
    imodel.withPreparedStatement(`SELECT count(*) AS [count] FROM ${className}`, (stmt: ECSqlStatement) => {
      assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
      const row = stmt.getRow();
      count = row.count;
    });
    return count;
  }

  public static getMinId(imodel: IModelDb, className: string): number {
    const stat = IModelTestUtils.executeQuery(imodel, `SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM ${className}`)[0];
    const minId: number = parseInt(stat.minId.toString().substring(2), 16);
    return minId;
  }

  public static createElemProps(className: string, _iModelName: IModelDb, modId: Id64String, catId: Id64String): TestElementProps {
    // add Geometry
    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];
    const geometryStream: GeometryStreamProps = [];
    for (const geom of geomArray) {
      const arcData = GeomJson.Writer.toIModelJson(geom);
      geometryStream.push(arcData);
    }
    // Create props
    const elementProps: TestElementProps = {
      classFullName: `PerfTestDomain:${className}`,
      model: modId,
      category: catId,
      code: Code.createEmpty(),
      geom: geometryStream,
    };
    if (className === "PerfElementSub3") {
      elementProps.sub3Str = values.sub3Str;
      elementProps.sub3Long = values.sub3Long;
      elementProps.sub3Double = values.sub3Double;
    }
    if (className === "PerfElementSub3" || className === "PerfElementSub2") {
      elementProps.sub2Str = values.sub2Str;
      elementProps.sub2Long = values.sub2Long;
      elementProps.sub2Double = values.sub2Double;
    }
    if (className === "PerfElementSub3" || className === "PerfElementSub2" || className === "PerfElementSub1") {
      elementProps.sub1Str = values.sub1Str;
      elementProps.sub1Long = values.sub1Long;
      elementProps.sub1Double = values.sub1Double;
    }
    elementProps.baseStr = values.baseStr;
    elementProps.baseLong = values.baseLong;
    elementProps.baseDouble = values.baseDouble;
    return elementProps;
  }
}

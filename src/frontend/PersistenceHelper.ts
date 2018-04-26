/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PersistentKeysContainer, KeySet } from "@bentley/ecpresentation-common";
import { Id64 } from "@bentley/bentleyjs-core";

export default class PersistenceHelper {

  public static async createPersistentKeysContainer(imodel: IModelConnection, keyset: KeySet): Promise<PersistentKeysContainer> {
    const instanceClassNames = Array.from(keyset.instanceKeys.keys());
    const instanceClassNameBindings = instanceClassNames.map(() => "?").join(",");
    const modelClassNameObjs = await imodel.executeQuery(`
      SELECT s.Alias || '.' || c.Name AS fullClassName
        FROM [meta].[ECSchemaDef] s
        JOIN [meta].[ECClassDef] c ON c.SchemaId = s.ECInstanceId
        JOIN [meta].[ClassHasAllBaseClasses] b ON b.SourceECInstanceId = c.ECInstanceId
        JOIN [meta].[ECClassDef] mc ON mc.ECInstanceId = b.TargetECInstanceId
        JOIN [meta].[ECSchemaDef] ms ON ms.ECInstanceId = mc.SchemaId
       WHERE ms.Alias || '.' || mc.Name = 'bis.Model'
             AND s.Alias || '.' || c.Name IN (${instanceClassNameBindings})
    `, instanceClassNames);
    const modelClassNames = new Set(modelClassNameObjs.map((o: any) => (o.fullClassName as string)));
    let modelIds = new Array<Id64>();
    let elementIds = new Array<Id64>();
    for (const entry of keyset.instanceKeys.entries()) {
      const className = entry[0];
      const ids = entry[1];
      if (modelClassNames.has(className))
        modelIds = modelIds.concat(Array.from(ids));
      else
        elementIds = elementIds.concat(Array.from(ids));
    }
    return {
      models: modelIds,
      elements: elementIds,
      nodes: Array.from(keyset.nodeKeys),
    };
  }

  public static async createKeySet(imodel: IModelConnection, container: PersistentKeysContainer): Promise<KeySet> {
    const keyset = new KeySet();
    keyset.add(container.nodes);
    keyset.add(await imodel.models.getProps(container.models));
    keyset.add(await imodel.elements.getProps(container.elements));
    return keyset;
  }

}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as path from "path";
import { IModelFileSystemProps, NamedIModelAccessContextProps, IModelFileSystemIModelProps, makeNamedIModelAccessContextPropsFromFileSystem } from "./IModelBankAccessContext";
import { Guid, IModelHubStatus } from "@bentley/bentleyjs-core";
import { IModelHubError } from "../imodelhub/Errors";

export class IModelBankFileSystemAdmin {
  public rootDir: string;

  constructor(workDir: string) {
    this.rootDir = path.join(workDir, "bankfs");
    fsextra.mkdirpSync(this.rootDir);
  }

  public getIModelFileSystemRootDir(name: string): string {
    return path.join(this.rootDir, name);
  }

  public getIModelFileSystemPropsFile(name: string): string {
    return path.join(this.getIModelFileSystemRootDir(name), "imodelfs.json");
  }

  public getIModelDir(projectName: string, iModelId: string): string {
    return path.join(this.getIModelFileSystemRootDir(projectName), iModelId);
  }

  public getIModelPropsFileName(projectName: string, iModelId: string): string {
    return path.join(this.getIModelDir(projectName, iModelId), "imodel.json");
  }

  public writeImodelFsFile(projectName: string, props: IModelFileSystemProps) {
    fs.writeFileSync(this.getIModelFileSystemPropsFile(projectName), JSON.stringify(props));
  }

  public deleteProject(name: string) {
    const fsdir = this.getIModelFileSystemRootDir(name);
    if (fs.existsSync(fsdir))
      fsextra.removeSync(fsdir);
  }

  public getOrCreateProject(name: string): IModelFileSystemProps {
    const fsjsonfile = this.getIModelFileSystemPropsFile(name);
    const fsdir = path.dirname(fsjsonfile);

    if (!fs.existsSync(fsdir))
      fsextra.mkdirpSync(fsdir);

    if (!fs.existsSync(fsjsonfile)) {
      const imodelFsProps: IModelFileSystemProps = {
        name,
        id: Guid.createValue(),
        description: "",
        iModels: [],
      };
      this.writeImodelFsFile(name, imodelFsProps);
    }

    return require(fsjsonfile) as IModelFileSystemProps;
  }

  public createIModel(name: string, description: string, seedFile: string, projectId: string): NamedIModelAccessContextProps {
    const imodelfs = this.getOrCreateProject(projectId);
    const id = Guid.createValue();

    const imodelFileName = this.getIModelPropsFileName(projectId, id);

    const imdir = path.dirname(imodelFileName);

    if (fs.existsSync(imdir))
      throw new IModelHubError(IModelHubStatus.iModelAlreadyExists);

    if (!fs.existsSync(imdir))
      fsextra.mkdirpSync(imdir);

    const props: IModelFileSystemIModelProps = {
      name,
      description,
      id,
      seedFile,
    };

    fs.writeFileSync(imodelFileName, JSON.stringify(props));

    imodelfs.iModels.push(props);
    this.writeImodelFsFile(projectId, imodelfs);

    return makeNamedIModelAccessContextPropsFromFileSystem(props);
  }

  private indexOfIModel(imodelfs: IModelFileSystemProps, iModelId: string): number {
    for (let i = 0; i !== imodelfs.iModels.length; ++i) {
      if (imodelfs.iModels[i].id === iModelId) {
        return i;
      }
    }
    return -1;
  }

  public deleteIModel(projectId: string, iModelId: string): void {
    const imodelfs = this.getOrCreateProject(projectId);
    const iFound = this.indexOfIModel(imodelfs, iModelId);
    if (iFound === -1)
      return;

    const imdir = this.getIModelDir(projectId, iModelId);
    fsextra.removeSync(imdir);

    imodelfs.iModels = imodelfs.iModels.filter((_props: IModelFileSystemIModelProps, index: number) => index === iFound);
    this.writeImodelFsFile(projectId, imodelfs);
  }
}

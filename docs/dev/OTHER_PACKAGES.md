# Using local builds of other Bentley libraries

Occasionally developers will want to make changes to other libraries
and test their changes while working on ECPresentation library. The standard
*npm* way of doing that is `npm link`. Because this repository uses Rush,
libraries should be linked to `{repository_root}/common/temp`:
```batch
cd common/temp
npm link /path/to/package
cd ../../
```
The above command will make sure all dependents of the linked library
use it from the linked location.

**Warning:** Because of the way Rush works, using `npm link` can corrupt
the setup created by Rush. In fact, using `npm link` is not recommended
by Rush. So here are some suggestions:
- Only do `npm link` after `rush install`
- To restore to a clean state, use `rush install`
- If, for some reason, it looks like the state got corrupted, use `rush install --clean`

## Specific to node addon

### Building local version of the addon

You can pull and build node addon using these steps:
```batch
bb -s iModelJsNodeAddon;BuildAll pull
bb -s iModelJsNodeAddon;BuildAll build
```
The above commands will create a folder `{OutRoot}/Winx64/packages`.

### Linking local version of the addon

The next step is make npm use these packages. After running `rush install`:
```batch
cd common/temp
npm link {OutRoot}/Winx64/packages/imodeljs-native-platform-api
npm link {OutRoot}/Winx64/packages/imodeljs-native-platform-electron
npm link {OutRoot}/Winx64/packages/imodeljs-native-platform-node
npm link {OutRoot}/Winx64/packages/imodeljs-n_8_9-win32-x64
npm link {OutRoot}/Winx64/packages/imodeljs-e_1_6_11-win32-x64
cd ../../
```
**Note:** Replace `{OutRoot}` with the location where BentleyBuild creates its output.

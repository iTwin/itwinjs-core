# Working on Node Addon

## Using local build

You can pull and build the node addon using these steps:
```batch
bb -s iModelJsNodeAddon;BuildAll pull
bb -s iModelJsNodeAddon;BuildAll build
```
The above commands will create a folder `{OutRoot}/Winx64/packages`.

The next step is make npm use these packages. After running `rush install`:
```batch
cd common/temp
npm link {OutRoot}/Winx64/packages/imodeljs-e_1_6_11-win32-x64
npm link {OutRoot}/Winx64/packages/imodeljs-electronaddon
npm link {OutRoot}/Winx64/packages/imodeljs-n_8_9-win32-x64
npm link {OutRoot}/Winx64/packages/imodeljs-nodeaddon
npm link {OutRoot}/Winx64/packages/imodeljs-nodeaddonapi
```
**Note:** Replace `{OutRoot}` with the location where BentleyBuild creates its output.

**Note:** `rush install` removes the links created by the above commands
so they should be created again, if needed.

**Warning:** The above steps aren't recommended by `rush` tool. In case you notice issues with `rush`, try running the following command:
```batch
rush install --clean
```

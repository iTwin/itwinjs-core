#!/bin/zsh
cp $OutRoot/MacOSX64/packages/imodeljs-native-platform-api/*          ./common/temp/node_modules/@bentley/imodeljs-native-platform-api
mkdir -p ./tools/native-platform-installer/node_modules/@bentley/imodeljs-native-platform-api
cp $OutRoot/MacOSX64/packages/imodeljs-native-platform-api/*          ./tools/native-platform-installer/node_modules/@bentley/imodeljs-native-platform-api
cp -r $OutRoot/MacOSX64/packages/imodeljs-n_8-darwin-x64               ./common/temp/node_modules/@bentley
cp -r $OutRoot/MacOSX64/packages/imodeljs-n_8-darwin-x64               ./tools/native-platform-installer/node_modules/@bentley
cp -r $OutRoot/MacOSX64/packages/imodeljs-e_2-darwin-x64               ./common/temp/node_modules/@bentley
cp -r $OutRoot/MacOSX64/packages/imodeljs-e_2-darwin-x64               ./tools/native-platform-installer/node_modules/@bentley

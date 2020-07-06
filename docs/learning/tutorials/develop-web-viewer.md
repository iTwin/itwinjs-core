## Developing a web viewer

### Setup
- [Install necessary prerequisites]($docs/getting-started/development-prerequisites)
- [Clone imodeljs-samples repo](https://github.com/imodeljs/imodeljs-samples)

### Build
- Open the cloned repo in VS Code
- `cd interactive-app`
- `cd basic-viewport-app`
- Edit interactive-app\basic-viewport-app\.env.local
    > `imjs_test_imodel` = The name of your iModel<br/>

- `npm install`
- `npm run build`

### Run
- `npm run start:servers`

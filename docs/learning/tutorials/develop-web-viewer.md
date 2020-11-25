## Developing a web viewer

### Setup
- [Install necessary prerequisites]($docs/getting-started/development-prerequisites)
- [Clone imodeljs-samples repo](https://github.com/imodeljs/imodeljs-samples)
- Have access to a cloud hosted iModel. If you do not have access to one, follow one of our tutorials to [create an online iModel]($docs/learning/tutorials/index.md)

### Build
- Open the cloned repo in VS Code
- `cd interactive-app`
- `cd basic-viewport-app`
- Edit interactive-app\basic-viewport-app\\.env.local
    > `imjs_test_imodel` = The name of your iModel<br/>

- `npm install`
- `npm run build`

### Run
- `npm run start:servers`

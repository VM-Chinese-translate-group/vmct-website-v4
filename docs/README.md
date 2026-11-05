<div align="center">
  <img src="public/imgs/logo/logo_256.png" alt="VM汉化组" width="128" height="128" />
</div>

# VM汉化组官网 v4

立即访问：<https://www.vmct.top/>

## 📖 使用与部署

官网采用运行时动态渲染，内容发布无需构建；Vue 内容后台在 VMPM 内嵌并统一登录。架构、联调与部署顺序见 [动态官网说明](DYNAMIC_SITE.md)。

我们推荐使用 VSCode 编辑器进行开发。

在开发前，请先安装 [NodeJS](https://nodejs.org/zh-cn/download/prebuilt-installer)，推荐安装 Node24。

安装依赖：

```sh
pnpm i
```

开发预览：

```sh
pnpm run dev
```

构建：

```sh
pnpm run build
```

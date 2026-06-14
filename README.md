# EVM Wallet Studio

一个纯前端的 EVM 钱包工具，支持助记词派生、靓号生成、余额查询、交易构建、ABI 合约调用、精度转换和时间转换。

私钥、助记词和签名操作都在浏览器本地完成。

## 运行

安装依赖：

```bash
npm ci
```

启动开发服务：

```bash
npm run dev
```

构建：

```bash
npm run build
```

预览构建结果：

```bash
npm run preview
```

## 部署

项目已配置 GitHub Actions 自动部署到 GitHub Pages。

GitHub 仓库需要在 `Settings -> Pages` 中将 `Source` 设置为 `GitHub Actions`。

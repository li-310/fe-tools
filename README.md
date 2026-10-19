# fe-tools

终端交互式数据处理工具集。在终端选择工具、输入数据、执行后返回结果，支持复制到剪贴板或保存到文件。

## 快速开始

```bash
npm run tool
```

或全局安装后直接调用：

```bash
npm link        # 一次性创建全局软链接
fe-tools        # 任意目录直接运行
```

## 已有工具

| 工具 | 操作 | 说明 |
| --- | --- | --- |
| 清洗魔方JSON | 清洗 | 解析 JSON，提取 `logicContext`，精简 `flows` 中的 `graphData`：节点只保留 `id` 和 `data`，边只保留 `source`/`target` 关系（按配置仅支持从文件读取、保存到文件） |
| 字符串脱敏 | 敏感词替换为 xx | 将 `pdd`、`afe`、`pinduoduo`、`ly` 替换为 `xx`，不区分大小写 |
| 拉取魔方项目配置 | 导出全部页面 dataSource 并汇总 | 访问 mofang-api，拉取指定魔方项目全部页面配置并解密，导出各页 dataSource，汇总指向 fuxi-api / meister-api 的数据源 |
| | 导出全部页面完整配置 JSON | 导出项目全部页面的完整配置 JSON（每页一个文件） |
| | 按 pageKey 导出单个页面配置 | 指定 pageKey，仅导出该页面的完整配置 JSON |
| Waterdrop 项目访问检测 | 批量检测项目页面可访问性 | 逐行检测 waterdrop 项目页面是否可访问 |

### 敏感词配置

脱敏词列表位于 `src/tools/desensitize.js` 第 1 行，增删直接修改数组即可：

```js
const SENSITIVE_WORDS = ['pinduoduo', 'pdd', 'afe', 'ly']
```

## 工具配置

根目录 `fe-tools.config.js` 用于调整工具展示顺序、限制单个工具的输入 / 输出方式：

```js
module.exports = {
  order: ['清洗魔方JSON'],   // 按数组顺序排在最前；未列出的工具默认顺序排在后面
  tools: {
    '清洗魔方JSON': {
      inputs: ['file'],      // 可选：'manual'（手动输入）、'file'（从文件读取），默认全部
      outputs: ['save']      // 可选：'copy'（复制到剪贴板）、'save'（保存到文件）、'overwrite'（覆盖写入原文件），默认全部
    }
  }
}
```

### 拉取魔方项目配置

- 需要 cookie：优先 `MOFANG_COOKIE` 环境变量，其次 cookie 文件（`MOFANG_COOKIE_FILE`，默认 `~/.mofang-cookie`）；文件存在时会询问是否直接使用，也可在运行时直接粘贴 Cookie 字符串临时使用（仅本次运行有效，可选保存到文件）
- 默认项目为 bbiz（`62c2e0345b3c3d00156c2f4f`），运行时可直接输入其他项目 ID
- dataSource 汇总默认输出到 `./mofang-export/`（汇总文件 `mofang-fuxi-meister-datasources.json`）；完整配置默认输出到 `./mofang-configs/`（单页导出默认也为其中的 `<标题>.json`）
- 运行前会显示页面数与请求规模，确认后才开始拉取；请求受并发（≤4）、间隔、单次页面数上限与失败保护限制
- 环境变量：`MOFANG_PROJECT_ID`、`MOFANG_ENV_ID`、`MOFANG_VERSION`、`MOFANG_COOKIE_FILE`、`MOFANG_CONCURRENCY`、`MOFANG_INTERVAL_MS`、`MOFANG_MAX_PAGES`（默认 300）

## 使用方式

1. 运行 `npm run tool`
2. 选择工具（输入序号）
3. 选择输入方式：手动输入 或 从文件读取（适合大 JSON）；可在 `fe-tools.config.js` 中限制为仅其中一种
4. 输入数据并执行
5. 结果处理：复制到剪贴板 / 保存到文件 / 覆盖写入到原文件（仅从文件读取时出现）/ 跳过（同样受 `fe-tools.config.js` 控制）
6. 回到菜单继续或退出

> 结果超过 30 行时终端只显示预览，可保存到文件查看完整内容。

## 添加新工具

在 `src/tools/` 下新建 `.js` 文件，按以下格式导出即可自动注册：

```js
module.exports = {
  name: '工具名',
  actions: [
    {
      name: '操作名',
      inputLabel: '输入提示',     // 可选
      multiline: true,            // 可选，多行输入（输入 ::end 结束）
      needInput: false,           // 可选，无需输入数据
      resultHandling: false,      // 可选，工具自行处理结果（不显示结果处理菜单）
      run: (input) => {           // 同步或 async，返回字符串
        return '处理结果'
      }
    }
  ]
}
```

工具在 `fe-tools.config.js` 的 `order` / `tools` 中按 `name` 引用。

## 项目结构

```
fe-tools/
├── bin/fe-tools.js             # CLI 入口：交互菜单循环
├── fe-tools.config.js          # 工具配置：排序 / 输入输出方式限制
├── src/
│   ├── config.js               # 配置加载
│   ├── tools/
│   │   ├── index.js            # 自动注册 src/tools/ 下所有工具并按配置排序
│   │   ├── processLogicContext.js  # 清洗魔方JSON
│   │   ├── desensitize.js      # 字符串脱敏
│   │   ├── mofang-menus.js     # 拉取魔方项目配置
│   │   └── waterdrop-check.js  # Waterdrop 项目访问检测
│   └── utils/
│       ├── prompt.js           # 交互提示（选单/输入/多行）
│       └── clipboard.js        # 剪贴板复制
└── package.json
```

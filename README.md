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
| 示例工具 | 反转字符串 | 将输入字符串逐字符反转 |
| | 统计字符数 | 统计输入字符串长度 |
| | 无需输入的示例 | 演示无需输入数据的 action 写法 |
| 清洗魔方JSON | 清洗 | 解析 JSON，提取 `logicContext`，精简 `flows` 中的 `graphData`：节点只保留 `id` 和 `data`，边只保留 `source`/`target` 关系 |
| 字符串脱敏 | 敏感词替换为 xx | 将 `pdd`、`afe`、`pinduoduo`、`ly` 替换为 `xx`，不区分大小写 |

### 敏感词配置

脱敏词列表位于 `src/tools/desensitize.js` 第 1 行，增删直接修改数组即可：

```js
const SENSITIVE_WORDS = ['pinduoduo', 'pdd', 'afe', 'ly']
```

## 使用方式

1. 运行 `npm run tool`
2. 选择工具（输入序号）
3. 选择输入方式：手动输入 或 从文件读取（适合大 JSON）
4. 输入数据并执行
5. 结果处理：复制到剪贴板 / 保存到文件 / 覆盖写入到原文件（仅从文件读取时出现）/ 跳过
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
      run: (input) => {           // 同步或 async，返回字符串
        return '处理结果'
      }
    }
  ]
}
```

## 项目结构

```
fe-tools/
├── bin/fe-tools.js            # CLI 入口：交互菜单循环
├── src/
│   ├── tools/
│   │   ├── index.js            # 自动注册 src/tools/ 下所有工具
│   │   ├── demo.js             # 示例工具
│   │   ├── processLogicContext.js  # 清洗魔方JSON
│   │   └── desensitize.js     # 字符串脱敏
│   └── utils/
│       ├── prompt.js           # 交互提示（选单/输入/多行）
│       └── clipboard.js        # 剪贴板复制
└── package.json
```

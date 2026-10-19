// fe-tools 配置
//
// order：工具展示顺序。按数组顺序排在最前展示；未列出的工具保持默认顺序排在后面。
// tools：按工具名限制单个工具可用的输入 / 输出方式。
//   inputs  可选值：'manual'（手动输入）、'file'（从文件读取），默认全部
//   outputs 可选值：'copy'（复制到剪贴板）、'save'（保存到文件）、'overwrite'（覆盖写入原文件），默认全部
module.exports = {
  order: ['清洗魔方JSON'],
  tools: {
    '清洗魔方JSON': {
      inputs: ['file'],
      outputs: ['save']
    }
  }
}

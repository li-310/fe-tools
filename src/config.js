const fs = require('fs')
const path = require('path')

const CONFIG_FILE = path.resolve(__dirname, '..', 'fe-tools.config.js')

const DEFAULT_INPUTS = ['manual', 'file']
const DEFAULT_OUTPUTS = ['copy', 'save', 'overwrite']

const EMPTY_CONFIG = { order: [], tools: {} }

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return EMPTY_CONFIG
  try {
    const raw = require(CONFIG_FILE)
    return {
      order: Array.isArray(raw.order) ? raw.order.filter((n) => typeof n === 'string') : [],
      tools: raw.tools && typeof raw.tools === 'object' ? raw.tools : {}
    }
  } catch (err) {
    console.warn(`  [警告] 读取配置失败（${CONFIG_FILE}）：${err.message}，已按默认配置运行`)
    return EMPTY_CONFIG
  }
}

function getToolConfig(config, toolName) {
  const raw = (config.tools && config.tools[toolName]) || {}
  return {
    inputs: Array.isArray(raw.inputs) && raw.inputs.length ? raw.inputs : DEFAULT_INPUTS,
    outputs: Array.isArray(raw.outputs) && raw.outputs.length ? raw.outputs : DEFAULT_OUTPUTS
  }
}

module.exports = { loadConfig, getToolConfig, CONFIG_FILE }

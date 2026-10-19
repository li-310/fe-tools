const fs = require('fs')
const path = require('path')
const { loadConfig } = require('../config')

const toolsDir = __dirname
const tools = []

fs.readdirSync(toolsDir)
  .filter((f) => f !== 'index.js' && f.endsWith('.js'))
  .sort()
  .forEach((file) => {
    const mod = require(path.join(toolsDir, file))
    if (mod && mod.name && Array.isArray(mod.actions)) {
      tools.push(mod)
    }
  })

const { order } = loadConfig()
const listed = []
order.forEach((name) => {
  const tool = tools.find((t) => t.name === name)
  if (!tool) {
    console.warn(`  [警告] 配置 order 中的工具不存在：${name}`)
    return
  }
  if (!listed.includes(tool)) listed.push(tool)
})

const rest = tools.filter((t) => !listed.includes(t))
tools.splice(0, tools.length, ...listed, ...rest)

module.exports = { tools }

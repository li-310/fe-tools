const fs = require('fs')
const path = require('path')

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

module.exports = { tools }

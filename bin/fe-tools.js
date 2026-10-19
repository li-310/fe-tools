#!/usr/bin/env node

const fs = require('fs')
const { tools } = require('../src/tools')
const { loadConfig, getToolConfig } = require('../src/config')
const { copyToClipboard } = require('../src/utils/clipboard')
const { selectList, input, readMultiline, closeRl } = require('../src/utils/prompt')

const EXIT = '退出'
const PREVIEW_LINES = 30

const INPUT_LABELS = {
  manual: '手动输入',
  file: '从文件读取（输入文件路径）'
}

const OUTPUT_LABELS = {
  copy: '复制到剪贴板',
  save: '保存到文件'
}

function displayResult(result) {
  const str = String(result)
  const lines = str.split('\n')
  if (lines.length <= PREVIEW_LINES) {
    console.log(str)
    return
  }
  console.log(lines.slice(0, PREVIEW_LINES).join('\n'))
  console.log(`\n  ... 共 ${lines.length} 行，已省略 ${lines.length - PREVIEW_LINES} 行（可保存到文件查看完整内容）`)
}

async function pickInputMode(allowedInputs) {
  const modes = allowedInputs.filter((m) => INPUT_LABELS[m])
  if (!modes.length) return 'manual'
  if (modes.length === 1) return modes[0]
  const choices = modes.map((m) => ({ name: INPUT_LABELS[m], value: m }))
  return selectList('请选择输入方式：', choices)
}

async function pickOutputMode(allowedOutputs, inputFilePath) {
  const choices = []
  if (allowedOutputs.includes('copy')) choices.push({ name: OUTPUT_LABELS.copy, value: 'copy' })
  if (allowedOutputs.includes('save')) choices.push({ name: OUTPUT_LABELS.save, value: 'save' })
  if (inputFilePath && allowedOutputs.includes('overwrite')) {
    choices.push({ name: `覆盖写入到原文件（${inputFilePath}）`, value: 'overwrite' })
  }
  choices.push({ name: '跳过', value: 'skip' })
  if (choices.length === 1) return 'skip'
  return selectList('结果处理：', choices)
}

async function runAction(tool, action, config) {
  const toolConfig = getToolConfig(config, tool.name)
  let data = ''
  let inputFilePath = null
  if (action.needInput !== false) {
    const mode = await pickInputMode(toolConfig.inputs)
    if (mode === 'file') {
      const filePath = (await input('请输入文件路径：')).trim()
      try {
        data = fs.readFileSync(filePath, 'utf-8').trim()
      } catch (err) {
        console.log(`\n  读取文件失败：${err.message}\n`)
        return
      }
      inputFilePath = filePath
    } else if (action.multiline) {
      data = (await readMultiline(action.inputLabel || '请输入数据：')).trim()
    } else {
      data = (await input(action.inputLabel || '请输入数据：')).trim()
    }
    if (!data) {
      console.log('  输入为空，已跳过。')
      return
    }
  }

  try {
    const result = await action.run(data)
    const str = String(result)
    console.log('\n  ── 结果 ─────────────────────────────')
    displayResult(result)
    console.log('  ─────────────────────────────────────\n')

    if (action.resultHandling === false) return

    const choice = await pickOutputMode(toolConfig.outputs, inputFilePath)
    if (choice === 'copy') {
      const ok = copyToClipboard(str)
      console.log(ok ? '  已复制到剪贴板。' : '  复制失败（未找到剪贴板工具）。')
    } else if (choice === 'save') {
      const filePath = (await input('请输入保存路径：')).trim()
      try {
        fs.writeFileSync(filePath, str, 'utf-8')
        console.log(`  已保存到 ${filePath}`)
      } catch (err) {
        console.log(`  保存失败：${err.message}`)
      }
    } else if (choice === 'overwrite') {
      try {
        fs.writeFileSync(inputFilePath, str, 'utf-8')
        console.log(`  已覆盖写入到 ${inputFilePath}`)
      } catch (err) {
        console.log(`  写入失败：${err.message}`)
      }
    }
  } catch (err) {
    console.log(`\n  执行出错：${err.message}\n`)
  }
}

async function pickAction(tool) {
  if (tool.actions.length === 1) {
    return tool.actions[0]
  }
  const choices = tool.actions.map((a) => ({ name: a.name, value: a }))
  return selectList('选择操作：', choices)
}

async function main() {
  const config = loadConfig()

  console.log('\n  ╔════════════════════════════════════╗')
  console.log('  ║        FE-Tools 数据处理工具        ║')
  console.log('  ╚════════════════════════════════════╝\n')

  while (true) {
    const choices = [
      ...tools.map((t) => ({ name: t.name, value: t })),
      { name: EXIT, value: null }
    ]
    const tool = await selectList('请选择工具：', choices)
    if (!tool) break

    const action = await pickAction(tool)
    if (!action) continue
    await runAction(tool, action, config)
  }

  closeRl()
  console.log('  再见！\n')
}

main().catch((err) => {
  console.error('发生意外错误：', err)
  process.exit(1)
})

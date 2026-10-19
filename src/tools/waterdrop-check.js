const https = require('https')

const BASE_URL = 'https://waterdrop.pdd.net/pcode/workbench/project/files/master?name='
const TIMEOUT = 10000
const RETRIES = 2
const CONCURRENCY = 4
const INTERVAL_MS = 200
const MAX_ITEMS = 200
const MAX_CONSECUTIVE_FAILURES = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: TIMEOUT }, (res) => {
      res.resume()
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 400
        resolve({ ok, statusCode: res.statusCode, error: null })
      })
    })
    req.on('timeout', () => {
      req.destroy(new Error(`请求超时（${TIMEOUT}ms）`))
    })
    req.on('error', (err) => {
      resolve({ ok: false, statusCode: 0, error: err.message })
    })
  })
}

async function checkUrlWithRetry(url) {
  let result
  for (let i = 0; i <= RETRIES; i++) {
    result = await checkUrl(url)
    if (result.statusCode !== 0) return result
    if (i < RETRIES) await sleep(500)
  }
  return result
}

module.exports = {
  name: 'Waterdrop 项目访问检测',
  actions: [
    {
      name: '批量检测项目页面可访问性',
      inputLabel: '请输入项目列表（每行一个，如 pdd-admin/json-editor）：',
      multiline: true,
      run: async (input) => {
        const names = input
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)

        if (!names.length) return '未解析到项目名。'
        if (names.length > MAX_ITEMS) {
          return `项目数 ${names.length} 超过单次上限 ${MAX_ITEMS}，请分批检测。`
        }

        const results = []
        let cursor = 0
        let consecutiveFailures = 0
        let aborted = false

        async function worker() {
          while (!aborted) {
            const i = cursor
            cursor += 1
            if (i >= names.length) return
            const name = names[i]
            const url = BASE_URL + encodeURIComponent(name)
            const { ok, statusCode, error } = await checkUrlWithRetry(url)
            results.push({ index: i, name, url, ok, statusCode, error })
            consecutiveFailures = ok ? 0 : consecutiveFailures + 1
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES || results.filter((r) => !r.ok).length * 2 > names.length) {
              aborted = true
              return
            }
            await sleep(INTERVAL_MS)
          }
        }

        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, names.length) }, worker))

        results.sort((a, b) => a.index - b.index)
        const lines = results.map(
          (r) =>
            `${r.ok ? '✅ 成功' : '❌ 失败'}  ${r.name}  [${r.statusCode || '无响应'}${r.error ? `：${r.error}` : ''}]`
        )
        const successCount = results.filter((r) => r.ok).length
        lines.push(`\n共 ${results.length} 个项目，成功 ${successCount} 个，失败 ${results.length - successCount} 个`)
        if (aborted) lines.push('检测已因连续失败/失败比例过高中止，剩余项目未检测')
        return lines.join('\n')
      }
    }
  ]
}

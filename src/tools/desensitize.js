const SENSITIVE_WORDS = ['pinduoduo', 'pdd', 'afe', 'ly']

module.exports = {
  name: '字符串脱敏',
  actions: [
    {
      name: '敏感词替换为 xx',
      inputLabel: '请输入要脱敏的文本：',
      multiline: true,
      run: (input) => {
        const regex = new RegExp(SENSITIVE_WORDS.join('|'), 'gi')
        return input.replace(regex, 'xx')
      }
    }
  ]
}

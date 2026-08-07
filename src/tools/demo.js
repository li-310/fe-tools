module.exports = {
  name: '示例工具',
  actions: [
    {
      name: '反转字符串',
      inputLabel: '请输入要反转的字符串：',
      run: (input) => input.split('').reverse().join('')
    },
    {
      name: '统计字符数',
      inputLabel: '请输入字符串：',
      run: (input) => `字符数：${input.length}`
    },
    {
      name: '无需输入的示例',
      needInput: false,
      run: () => '这是一个不需要输入数据的工具函数示例'
    }
  ]
}

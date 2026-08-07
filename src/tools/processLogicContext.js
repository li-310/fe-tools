// 辅助函数：处理 graphData，删除节点信息，保留逻辑关系和 data 字段
function processGraphData(graphData) {
  if (!Array.isArray(graphData)) {
    return graphData;
  }

  // 创建节点 ID 到 data 的映射
  const nodeDataMap = {};
  const edgeDataMap = {};

  // 遍历所有元素
  graphData.forEach((item, index) => {
    // 如果是节点，只保存 id 和 data
    if (item.shape === "base-node" && item.data) {
      nodeDataMap[item.id] = {
        data: item.data,
      };
    } else if (item.shape === "base-edge") {
      edgeDataMap[item.id] = {
        source: item.source?.cell,
        target: item.target?.cell,
      };
    }
  });

  // 返回处理后的 graphData，包含简化的边和节点数据映射
  return {
    edges: edgeDataMap,
    nodeData: nodeDataMap,
  };
}

// 辅助函数：处理 logicContext 中的所有 graphData
function processLogicContext(logicContext) {
  if (!logicContext || !logicContext.flows) {
    return logicContext;
  }

  const processedFlows = logicContext.flows.map((flow) => {
    if (flow.graphData) {
      return {
        ...flow,
        graphData: processGraphData(flow.graphData),
      };
    }
    return flow;
  });

  return {
    ...logicContext,
    flows: processedFlows,
  };
}

module.exports = {
  name: '清洗魔方JSON',
  actions: [
    {
      name: '清洗',
      inputLabel: '请输入要处理的JSON：',
      multiline: true,
      run: (input) => {
        const data = JSON.parse(input)
        return JSON.stringify(processLogicContext(data.logicContext), null, 2)
      }
    }
  ]
}

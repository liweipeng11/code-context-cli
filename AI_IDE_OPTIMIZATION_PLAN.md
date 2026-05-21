# JSP 转 Vue 上下文工具的 AI IDE 化优化计划

本文档用于规划 `ctx-cli` 的下一阶段优化方向。整体思路参考主流 AI IDE 的常见做法：代码库索引、chunk 检索、代码地图、依赖追踪、上下文预算控制，以及面向 Agent 的稳定工具接口。

本工具的核心目标不是做通用代码问答，而是让 LLM/Agent 能够在不读取完整大 JSP 的情况下，按功能区域理解并重构老系统 JSP 页面，最终生成 Vue 静态页面。

## 1. 当前能力基线

当前工具已经具备以下能力：

- `ctx index .`：扫描项目并生成 `.ctx/index.json`。
- `ctx search <query>`：基于关键词搜索代码 chunk。
- `ctx context <query>`：在 token 预算内生成 `.ctx/context.md`。
- `ctx chunk get <chunkId>`：根据 chunk id 精确读取一个已索引 chunk。
- `ctx slice <filePath> --start --end`：根据行号读取文件片段。
- `ctx around <filePath> --line`：读取某一行附近的代码。
- `ctx jsp regions <filePath> --json`：列出 JSP 中的功能区域。
- `ctx jsp region <filePath> --id <regionId> --with-related --json`：读取一个 JSP 功能区域及其相关代码。

最近最关键的改造是：JSP 文件现在可以优先按功能区域切分，而不是只按固定行数切分。

## 2. 目标架构

长期目标架构如下：

```text
项目扫描
  -> 增量文件索引
  -> 按语言切分 chunk
  -> JSP 功能区域解析
  -> JSP 依赖图
  -> 页面代码地图 / 功能流地图
  -> 混合检索
  -> 上下文预算编排
  -> 面向 Agent 的 JSON 工具接口
```

Agent 的理想使用流程如下：

```text
1. 列出 JSP 功能区域。
2. 查看 JSP 页面地图。
3. 选择一个功能区域或功能流。
4. 获取该区域的聚焦上下文。
5. 生成或更新 Vue 静态页面中的对应部分。
6. 继续处理下一个区域。
```

## 3. 阶段一：增强 JSP 功能区域识别

### 目标

让一个 3000 行左右的 JSP 能生成可用的“功能目录”，方便 LLM 先理解页面结构，再按区域读取代码。

### 任务

- 优化 `src/chunker/jspRegionParser.ts`。
- 支持更多 JSP 区域类型：
  - 查询表单
  - 结果列表
  - 工具栏
  - 按钮组
  - 弹窗 / 模态框
  - 隐藏表单
  - 分页区域
  - script 函数
  - directive / include 区块
- 改进区域名称推断，优先读取：
  - 附近 HTML 注释
  - 区域标题文本
  - `id`
  - `name`
  - `class`
  - 按钮文案
- 减少重复区域和噪声区域。
- 改进嵌套区域处理，避免父子区域互相干扰。

### 需要提取的元数据

- DOM id
- form action
- input/select/textarea 字段
- 按钮文案
- 表格列名
- 事件处理函数
- JSP EL 变量，例如 `${user.name}`
- JSP scriptlet 表达式，例如 `<%= userName %>`
- JSTL 变量
- include 路径
- 外部 JS/CSS 路径

### 命令

```bash
ctx jsp regions src/pages/UserDetail.jsp --json
```

### 期望输出结构

```json
[
  {
    "id": "query-form-120",
    "type": "jsp-form",
    "name": "查询条件",
    "summary": "查询表单，包含 6 个字段和 2 个按钮。",
    "startLine": 120,
    "endLine": 260,
    "metadata": {
      "domIds": ["queryForm"],
      "formActions": ["/user/list.do"],
      "events": ["queryData"],
      "fields": ["userName", "deptId"],
      "buttons": ["查询", "重置"]
    }
  }
]
```

### 验收标准

- 在真实老系统 JSP 页面中，主要可见功能区能被识别出来。
- 区域名称不读源码也能大致理解。
- 每个区域都有稳定行号和 `metadata.regionId`。
- 区域列表足够小，可以先交给 LLM 阅读，而不需要读取完整 JSP。

## 4. 阶段二：构建 JSP 依赖图

### 目标

当 Agent 请求某个 JSP 区域时，工具能自动找到理解该区域所需的相关代码。

### 需要追踪的关系

```text
region -> event handler
region -> form action
region -> ajax URL
region -> JSP include
region -> external JS/CSS
function -> function
function -> ajax URL
action URL -> XML action
action URL -> Java Action/Controller method
```

### 任务

- 新增依赖提取模块，例如：

```text
src/jsp/traceJspDependencies.ts
```

- 从事件属性中提取 JavaScript 调用：
  - `onclick="queryData()"`
  - `onchange="changeDept()"`
  - `href="javascript:openDialog()"`
- 从常见 AJAX 写法中提取 URL：
  - `$.ajax`
  - `$.post`
  - `$.get`
  - `fetch`
  - `XMLHttpRequest`
  - 项目自定义请求封装
- 追踪简单的函数调用链。
- 尽可能把 form action 和 AJAX URL 连接到 XML/Java chunk。

### 命令

```bash
ctx jsp region src/pages/UserDetail.jsp --id query-form-120 --with-related --json
```

### 期望输出结构

```json
{
  "region": {},
  "related": [
    {
      "chunk": {},
      "reason": "onclick 调用了 queryData",
      "priority": "high"
    },
    {
      "chunk": {},
      "reason": "queryData 请求了 /user/list.do",
      "priority": "high"
    }
  ]
}
```

### 验收标准

- `--with-related` 能返回区域直接引用的 JavaScript 处理函数。
- 每个相关 chunk 都带有清晰的 `reason`。
- 相关 chunk 按优先级排序。
- Agent 能知道为什么某段代码被加入上下文。

## 5. 阶段三：生成 JSP 功能地图

### 目标

让 Agent 在开始生成 Vue 之前，先用一个紧凑结构理解整个 JSP 页面的区域和交互流。

### 新增命令

```bash
ctx jsp map src/pages/UserDetail.jsp --json
```

### 地图内容

- 页面级 include
- 功能区域列表
- 区域摘要
- 事件流
- form action
- AJAX action
- 表格字段
- 弹窗关系
- 外部依赖

### 示例输出

```json
{
  "filePath": "src/pages/UserDetail.jsp",
  "regions": [],
  "flows": [
    {
      "name": "查询用户",
      "fromRegion": "query-form-120",
      "event": "queryData",
      "action": "/user/list.do",
      "resultRegion": "user-table-300"
    },
    {
      "name": "编辑用户",
      "fromRegion": "user-table-300",
      "event": "openEditDialog",
      "targetRegion": "edit-dialog-900",
      "saveAction": "/user/save.do"
    }
  ]
}
```

### 验收标准

- 页面地图可以在不读取源码的情况下被 LLM 理解。
- 能推断常见流程：查询、新增、编辑、删除、保存、刷新。
- 页面地图能驱动分步骤生成 Vue。

## 6. 阶段四：上下文预算编排

### 目标

随着依赖追踪能力增强，避免 `--with-related` 返回过多代码导致上下文再次超限。

### 优先级规则

```text
必选：
  当前 JSP region

高优先级：
  直接引用的事件函数
  form action / ajax URL
  当前区域使用的 JSP include

中优先级：
  直接事件函数内部调用的函数
  XML action 映射
  Java method chunk

低优先级：
  关键词搜索命中
  同页面较泛的 script chunk
```

### 新增命令

```bash
ctx jsp context src/pages/UserDetail.jsp --region query-form-120 --max-tokens 8000 --json
```

### 超预算降级规则

当上下文超过预算时：

- 保留必选 chunk。
- 长函数只保留签名和摘要。
- 对 URL/action 相关代码保留关键行附近片段。
- 优先丢弃低优先级 chunk。
- 输出被省略的 chunk 列表和原因。

### 验收标准

- context 命令严格遵守 max token 预算。
- 输出中包含已选择 chunk、被省略 chunk 和原因。
- 当前 region 永远不会被省略。

## 7. 阶段五：混合检索

### 目标

让搜索不再依赖用户输入和源码 token 完全一致。用户说“保存弹窗提交逻辑”，工具也能找到相关代码。

### 检索层

- 关键词检索
- 路径和文件名加权
- 符号检索
- metadata 检索
- 可选 BM25
- 可选 embedding
- 可选 rerank

### 命令

```bash
ctx search "保存弹窗提交逻辑" --json
```

### 任务

- 给 search 增加 JSON 输出模式。
- 输出每条结果的匹配原因和评分详情。
- 优先考虑轻量本地 BM25。
- embedding 作为可选能力，不作为硬依赖。

### 验收标准

- search 能根据业务意图找到相关 chunk，而不仅仅依赖精确字符串匹配。
- search 能解释每个结果为什么匹配。
- 保留当前无网络、轻量级的使用方式。

## 8. 阶段六：增量索引

### 目标

让 `ctx index .` 在大型老项目中足够快。

### 任务

- 对 hash 未变化的文件复用旧 chunks。
- 只重建发生变化的文件。
- 删除已不存在文件对应的 chunks。
- 保留 index version 元数据。
- 输出索引变化统计。

### 示例输出

```text
Indexed 2140 files.
Reused 2098 files.
Updated 39 files.
Removed 3 files.
Wrote .ctx/index.json
```

### 验收标准

- 小改动后重新执行 `ctx index .` 明显更快。
- `.ctx/index.json` 输出稳定。
- 修改、删除、新增文件都能正确反映到索引中。

## 9. 阶段七：Agent 工具接口

### 目标

暴露稳定的 JSON 优先操作，让 LLM/Agent 不需要猜测 shell 输出格式。

### 工具操作

```text
listJspRegions(filePath)
getJspRegion(filePath, regionId, withRelated)
getJspMap(filePath)
getJspContext(filePath, regionId, budget)
searchCode(query)
getChunk(chunkId)
readSlice(filePath, start, end)
readAround(filePath, line, before, after)
```

### 实现方式

- 第一阶段保持 CLI JSON 命令。
- 后续可以增加 MCP server 或本地 HTTP server。

### 验收标准

- 每个操作都有 JSON 输出。
- 错误也是机器可读的。
- Agent 可以在不读取完整文件的前提下完成 JSP 转 Vue 工作流。

## 10. 阶段八：评测集

### 目标

避免凭感觉判断检索质量是否提升。

### 测试语料

准备 5 到 10 个真实 JSP 文件，并记录期望结果：

- 应识别出的功能区域
- 每个区域的字段
- 每个区域的按钮
- 事件处理函数
- AJAX/form action
- 应关联到的相关 chunk
- 应推断出的页面功能流

### 新增命令

```bash
ctx eval jsp
```

### 指标

- 区域召回率
- 区域准确率
- 事件函数召回率
- action URL 召回率
- 相关 chunk 召回率
- 上下文 token 使用量
- 重复/噪声 chunk 数量

### 验收标准

- 每次 parser 或 retriever 修改后都能量化效果。
- 回归问题能被及时发现。
- 真实 JSP 转 Vue 任务变得可重复、可比较。

## 11. 推荐交付顺序

```text
1. 增强 JSP 功能区域识别
2. 构建 JSP 依赖图
3. 生成 JSP 功能地图
4. 增加上下文预算编排
5. 增加增量索引
6. 增加混合检索
7. 增加 Agent 工具接口
8. 建立评测集
```

前 3 个阶段应优先完成，因为它们直接决定 JSP 转 Vue 的上下文质量。混合检索和 embedding 很有价值，但应放在 JSP 结构和依赖图稳定之后。

## 12. 近期里程碑

下一个实用里程碑建议做到：

```text
ctx index .
ctx jsp regions UserDetail.jsp --json
ctx jsp map UserDetail.jsp --json
ctx jsp context UserDetail.jsp --region query-form-120 --max-tokens 8000 --json
```

达到这个里程碑后，Agent 就可以：

1. 查看页面结构。
2. 选择一个功能区域。
3. 获取受 token 预算控制的相关上下文。
4. 生成对应 Vue 区块。
5. 按区域持续推进完整页面重构。


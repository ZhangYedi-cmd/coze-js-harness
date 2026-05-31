---
name: harness-register
description: |
  把一个已存在的执行层 skill 接入 harness 调度器。读取目标 skill 的 SKILL.md，
  判断粒度（Package / Repo），自动生成包含 /repo-lens 选包 + parse-history 去重
  的标准 prompt，追加到 .claude/harness/tasks.md。新增任务从想法到上线 <30 分钟。
agent: general-purpose
allowed-tools: >
  Read, Edit, Write,
  Bash(bash *),
  Bash(grep *),
  Bash(ls *),
  Bash(test *)
argument-hint: <skill-name> [--weight <n>] [--scope package|repo] [--description "..."]
---

# harness-register

把已开发好的 skill 注册到 harness 调度器。前置条件：目标 skill 在
`.claude/skills/<skill-name>/SKILL.md` 已存在且本地手动验证过行为符合预期。

## 参数解析

```
SKILL_NAME    = $ARGUMENTS 中第一个非 -- 参数（必填）
WEIGHT        = $ARGUMENTS 中 --weight 后的值（默认 5）
SCOPE_OVERRIDE = $ARGUMENTS 中 --scope 后的值（package | repo；缺省自动判断）
DESCRIPTION_OVERRIDE = $ARGUMENTS 中 --description 后的值（缺省取 skill frontmatter）
```

参数缺失：
- 没有 `SKILL_NAME` → 退出，提示 `usage: /harness-register <skill-name> [--weight <n>] [--scope ...] [--description "..."]`
- `WEIGHT` 非数字或 ≤ 0 → 退出

---

## 流程总览

```
Phase 1  校验目标 skill 存在
Phase 2  读取 SKILL.md，提取 description、argument-hint
Phase 3  判断粒度（Package / Repo）
Phase 4  组装标准 prompt
Phase 5  检查 tasks.md 是否已注册同名任务
Phase 6  追加到 tasks.md，打印结果
```

---

## Phase 1：校验目标 skill 存在

```bash
SKILL_DIR=".claude/skills/$SKILL_NAME"
SKILL_FILE="$SKILL_DIR/SKILL.md"

[ -f "$SKILL_FILE" ] || {
  echo "❌ 找不到 $SKILL_FILE"
  echo "   先在 $SKILL_DIR/ 下创建 SKILL.md 并手动验证一两个包，再来 register。"
  exit 1
}
```

---

## Phase 2：读取 skill 元信息

用 Read 工具读 `$SKILL_FILE`，从 frontmatter 提取：
- `description`：作为任务的 description（若 `DESCRIPTION_OVERRIDE` 非空则用 override）
- `argument-hint`：判断 skill 是否接收 `<package>` 这种位置参数

```
SKILL_DESCRIPTION = frontmatter.description 第一行（去换行）
ARG_HINT          = frontmatter.argument-hint
TASK_DESCRIPTION  = DESCRIPTION_OVERRIDE 或 SKILL_DESCRIPTION
```

---

## Phase 3：判断粒度

优先用 `SCOPE_OVERRIDE`。没有就自动判断：

| 条件 | 粒度 |
|---|---|
| `ARG_HINT` 含 `<package>` 或 `<pkg>` 或 `<path>` | `package` |
| SKILL.md 正文出现 "目标包" / "selected package" / "single package" | `package` |
| 否则 | `repo` |

```
SCOPE = SCOPE_OVERRIDE 或 自动判断结果
```

---

## Phase 4：组装标准 prompt

### Package 粒度模板

```yaml
prompt: |
  1. 运行 /repo-lens --task <SKILL_NAME>，获取仓库候选包推荐列表（按评分从高到低）
  2. 运行 node .claude/skills/harness-dispatcher/parse-history.js，排除近 30 天已被 <SKILL_NAME> 处理过的包
  3. 从剩余候选中选取推荐分最高的包
  4. 运行 /<SKILL_NAME> <selected-package> --yes
  5. 输出执行摘要：处理的包、改动文件数、是否成功
```

### Repo 粒度模板

```yaml
prompt: |
  1. 运行 /<SKILL_NAME> --yes
  2. 输出执行摘要：改动文件数、是否成功
```

把上面占位符 `<SKILL_NAME>` 替换成实际名字，得到 `RENDERED_PROMPT`。

---

## Phase 5：检查是否重复注册

```bash
if grep -q "^name: $SKILL_NAME$" .claude/harness/tasks.md; then
  echo "⚠️  tasks.md 中已存在同名任务 '$SKILL_NAME'。"
  echo "   要重新注册请先删掉对应的 task 块，或用不同的 name。"
  exit 1
fi
```

---

## Phase 6：追加到 tasks.md

用 Edit 工具在 `tasks.md` 文件末尾追加：

```
<!-- task
name: <SKILL_NAME>
description: <TASK_DESCRIPTION>
prompt: |
  <RENDERED_PROMPT 内容，按行缩进 2 个空格>
weight: <WEIGHT>
enabled: true
-->
```

追加之前确认末尾留一个空行，避免和上一个 task 块粘住。

校验：追加后 `grep -c '^<!-- task' .claude/harness/tasks.md` 应该比之前多 1。

打印结果：
```
✅ 已注册任务：<SKILL_NAME>
   description: <TASK_DESCRIPTION>
   scope: <SCOPE>
   weight: <WEIGHT>
   位置: .claude/harness/tasks.md（末尾）

下一步：
  - 本地试跑：claude -p '/harness-dispatcher --task <SKILL_NAME> --dry-run'
  - 真正执行：claude -p '/harness-dispatcher --task <SKILL_NAME>'
  - 不满意 prompt 内容？直接改 tasks.md。
```

---

## 设计说明

- **不生成 skill 代码**：注册器只负责"接入"，skill 本体必须先手动开发好。这是文章
  2.4 节"两步流程"的第二步——第一步（写 skill + 手动验证）由人完成，第二步（注册）
  由这个 skill 完成。
- **prompt 模板内置了 /repo-lens + parse-history**：这两个步骤几乎所有 Package 粒度
  任务都需要，模板化能避免手写时漏掉。
- **不自动调权重**：初始 weight 由人决定（建议参考踩坑 6.6 的分层：删除型 10、
  类型修复 6–8、补测试/升级类 3–5）。之后由 `harness-audit` 根据成功率自动调整。
- **重复注册保护**：避免误操作把同一 skill 注册多份导致权重事实上翻倍。

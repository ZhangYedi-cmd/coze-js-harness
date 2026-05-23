#!/usr/bin/env node
/**
 * 解析 docs/harness/ 下的运行日志文件，返回结构化历史记录。
 * 调度器用此脚本计算历史折扣（7 天内执行过的任务权重减半）。
 *
 * 日志文件命名约定：YYYY-MM-DD-<task-name>.md
 * 日志文件内容约定（frontmatter 格式）：
 *   task: <task-name>
 *   date: <YYYY-MM-DD>
 *   package: <package-name>   （可选，Package 粒度任务才有）
 *   success: true|false
 *
 * 输出：JSON 数组到 stdout
 *   [{ task, date, package, success }, ...]
 */

const fs = require('fs');
const path = require('path');

const HARNESS_DIR = path.join(process.cwd(), 'docs', 'harness');

function parseLogFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const record = {};

  // 从文件名提取 task 和 date（格式：YYYY-MM-DD-<task>.md）
  const basename = path.basename(filePath, '.md');
  const dateMatch = basename.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (dateMatch) {
    record.date = dateMatch[1];
    record.task = dateMatch[2];
  }

  // 从文件内容的 frontmatter 区块提取字段
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (!key) continue;
      const value = valueParts.join(':').trim();
      const k = key.trim();
      if (k === 'task') record.task = value;
      else if (k === 'date') record.date = value;
      else if (k === 'package') record.package = value;
      else if (k === 'success') record.success = value === 'true';
    }
  }

  return record.task && record.date ? record : null;
}

function main() {
  if (!fs.existsSync(HARNESS_DIR)) {
    console.log('[]');
    return;
  }

  const files = fs.readdirSync(HARNESS_DIR)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .map(f => path.join(HARNESS_DIR, f));

  const records = files
    .map(parseLogFile)
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date)); // 最新的在前

  console.log(JSON.stringify(records, null, 2));
}

main();

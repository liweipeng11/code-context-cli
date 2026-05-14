#!/usr/bin/env node
import commander = require("commander");
import { runInit } from "./commands/init";
import { runIndex } from "./commands/index";
import { runSearch } from "./commands/search";
import { runContext } from "./commands/context";
import { runClean } from "./commands/clean";
import { resolveProjectPath } from "./utils/pathUtils";
import { error } from "./utils/logger";

function main(): void {
  /*
   * CLI 入口只负责两件事：
   * 1. 声明命令、参数和帮助信息；
   * 2. 把真正的业务交给 commands 目录中的 runXxx 函数。
   *
   * 这样做的好处是：后续即使要加测试，也可以直接测试 runIndex/runSearch，
   * 不必模拟命令行输入。
   */
  var program = new commander.Command();
  program
    .name("ctx")
    .description("Build lightweight code context for LLM prompts.")
    .version("0.1.0");

  program
    .command("init")
    .description("Create .ctxrc.json in the current directory.")
    .action(function () {
      runInit(process.cwd());
    });

  program
    .command("index [projectPath]")
    .description("Scan project and build .ctx/index.json.")
    .action(function (projectPath: string | undefined) {
      // index 支持传目录；不传时默认当前目录。
      runIndex(resolveProjectPath(projectPath || "."));
    });

  program
    .command("search <query>")
    .description("Search indexed chunks.")
    .option("-n, --top <number>", "Number of chunks to show.", "10")
    .action(function (query: string, options: { top: string }) {
      // search/context 默认读取当前目录下的 .ctx/index.json。
      runSearch(process.cwd(), query, parseInt(options.top, 10) || 10);
    });

  program
    .command("context <query>")
    .description("Generate .ctx/context.md for a task.")
    .option("-n, --top <number>", "Number of candidate chunks.", "30")
    .action(function (query: string, options: { top: string }) {
      runContext(process.cwd(), query, parseInt(options.top, 10) || 30);
    });

  program
    .command("clean")
    .description("Remove .ctx directory.")
    .action(function () {
      runClean(process.cwd());
    });

  program.parse(process.argv);
}

try {
  main();
} catch (err) {
  // 顶层兜底错误处理：保证命令失败时输出清晰错误，而不是打印一大段堆栈。
  error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}

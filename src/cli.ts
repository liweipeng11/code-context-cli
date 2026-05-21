#!/usr/bin/env node
import commander = require("commander");
import { runInit } from "./commands/init";
import { runIndex } from "./commands/index";
import { runSearch } from "./commands/search";
import { runContext } from "./commands/context";
import { runClean } from "./commands/clean";
import { runChunkGet } from "./commands/chunk";
import { runSlice } from "./commands/slice";
import { runAround } from "./commands/around";
import { runJspContext, runJspMap, runJspRegion, runJspRegions } from "./commands/jsp";
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
    .option("--json", "Print JSON output.")
    .action(function (query: string, options: { top: string; json?: boolean }) {
      // search/context 默认读取当前目录下的 .ctx/index.json。
      runSearch(process.cwd(), query, parseInt(options.top, 10) || 10, Boolean(options.json));
    });

  program
    .command("context <query>")
    .description("Generate .ctx/context.md for a task.")
    .option("-n, --top <number>", "Number of candidate chunks.", "30")
    .action(function (query: string, options: { top: string }) {
      runContext(process.cwd(), query, parseInt(options.top, 10) || 30);
    });

  var chunkCommand = program
    .command("chunk")
    .description("Read indexed chunks.");

  chunkCommand
    .command("get <chunkId>")
    .description("Read one chunk by id from .ctx/index.json.")
    .option("--json", "Print JSON output.")
    .action(function (chunkId: string, options: { json?: boolean }) {
      runChunkGet(process.cwd(), chunkId, Boolean(options.json));
    });

  program
    .command("slice <filePath>")
    .description("Read a line range from a project file.")
    .requiredOption("--start <line>", "Start line.")
    .requiredOption("--end <line>", "End line.")
    .option("--json", "Print JSON output.")
    .action(function (filePath: string, options: { start: string; end: string; json?: boolean }) {
      runSlice(process.cwd(), filePath, parseInt(options.start, 10), parseInt(options.end, 10), Boolean(options.json));
    });

  program
    .command("around <filePath>")
    .description("Read lines around a target line from a project file.")
    .requiredOption("--line <line>", "Target line.")
    .option("--before <number>", "Lines before target line.", "30")
    .option("--after <number>", "Lines after target line.", "30")
    .option("--json", "Print JSON output.")
    .action(function (filePath: string, options: { line: string; before: string; after: string; json?: boolean }) {
      runAround(
        process.cwd(),
        filePath,
        parseInt(options.line, 10),
        parseInt(options.before, 10),
        parseInt(options.after, 10),
        Boolean(options.json)
      );
    });

  var jspCommand = program
    .command("jsp")
    .description("Inspect JSP functional regions.");

  jspCommand
    .command("map <filePath>")
    .description("Build a compact page map for one JSP file.")
    .option("--json", "Print JSON output.")
    .action(function (filePath: string, options: { json?: boolean }) {
      runJspMap(process.cwd(), filePath, Boolean(options.json));
    });

  jspCommand
    .command("regions <filePath>")
    .description("List functional regions in one indexed JSP file.")
    .option("--json", "Print JSON output.")
    .action(function (filePath: string, options: { json?: boolean }) {
      runJspRegions(process.cwd(), filePath, Boolean(options.json));
    });

  jspCommand
    .command("region <filePath>")
    .description("Read one JSP functional region by region id.")
    .requiredOption("--id <id>", "Region id from ctx jsp regions.")
    .option("--with-related", "Include related chunks from the same JSP and linked files.")
    .option("--json", "Print JSON output.")
    .action(function (filePath: string, options: { id: string; withRelated?: boolean; json?: boolean }) {
      runJspRegion(process.cwd(), filePath, options.id, Boolean(options.withRelated), Boolean(options.json));
    });

  jspCommand
    .command("context <filePath>")
    .description("Build a budgeted JSP region context with related chunks.")
    .requiredOption("--region <id>", "Region id from ctx jsp regions.")
    .option("--max-tokens <number>", "Maximum estimated tokens for JSON output.", "8000")
    .option("--json", "Print JSON output.")
    .action(function (filePath: string, options: { region: string; maxTokens: string; json?: boolean }) {
      runJspContext(process.cwd(), filePath, options.region, parseInt(options.maxTokens, 10) || 8000, Boolean(options.json));
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

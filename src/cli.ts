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
      runIndex(resolveProjectPath(projectPath || "."));
    });

  program
    .command("search <query>")
    .description("Search indexed chunks.")
    .option("-n, --top <number>", "Number of chunks to show.", "10")
    .action(function (query: string, options: { top: string }) {
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
  error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}

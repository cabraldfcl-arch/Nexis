#!/usr/bin/env node

import {
  getDiagnosticExitCode,
  runBetkolContractCheck,
} from "./betkol-contract-checker.mjs";

const inputFile = process.argv[2] ?? null;
const diagnostic = await runBetkolContractCheck({
  env: process.env,
  inputFile,
});

process.stdout.write(`${JSON.stringify(diagnostic, null, 2)}\n`);
process.exitCode = getDiagnosticExitCode(diagnostic);

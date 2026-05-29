#!/usr/bin/env node

import nextEnv from "@next/env";
import {
  buildAiProviderDiagnosticOutput,
  getAiProviderDiagnosticExitCode,
  runAiProviderDiagnostic,
} from "./ai-provider-diagnostic.mjs";

const silentLogger = {
  error() {},
  info() {},
  warn() {},
};

nextEnv.loadEnvConfig(process.cwd(), true, silentLogger);

const diagnostic = await runAiProviderDiagnostic({
  env: process.env,
});

process.stdout.write(buildAiProviderDiagnosticOutput(diagnostic));
process.exitCode = getAiProviderDiagnosticExitCode(diagnostic);

#!/usr/bin/env node
import { runAndPrint } from "./index.js";

process.exitCode = await runAndPrint(process.argv.slice(2));

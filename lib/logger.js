// Run logger — writes timestamped log to library/<slug>/output/run.log
import fs from 'fs';
import path from 'path';

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function elapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

class Logger {
  constructor() {
    this.lines  = [];
    this.logPath = null;
    this.runStart = Date.now();
  }

  init(outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    this.logPath  = path.join(outputDir, 'run.log');
    this.runStart = Date.now();
    this.lines    = [];
  }

  // Write a line to the log file (does NOT print to console)
  write(msg) {
    const line = `[${ts()}] ${msg}`;
    this.lines.push(line);
    if (this.logPath) {
      fs.appendFileSync(this.logPath, line + '\n', 'utf8');
    }
  }

  // Start a named stage — returns a function to call when the stage ends
  stage(name) {
    const t0 = Date.now();
    this.write(`START  ${name}`);
    return (detail = '') => {
      const dur = elapsed(Date.now() - t0);
      this.write(`END    ${name}  [${dur}]${detail ? '  ' + detail : ''}`);
      return dur;
    };
  }

  // Log an error
  error(msg) {
    this.write(`ERROR  ${msg}`);
  }

  // Log a note (informational, no stage timing)
  info(msg) {
    this.write(`INFO   ${msg}`);
  }

  // Write a summary footer and return the log path
  finish(htmlPath) {
    const total = elapsed(Date.now() - this.runStart);
    this.write(`─`.repeat(60));
    this.write(`DONE   Total run time: ${total}`);
    if (htmlPath) this.write(`OUTPUT ${htmlPath}`);
    return this.logPath;
  }
}

// Singleton — imported and shared across modules
export const logger = new Logger();

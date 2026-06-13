#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const settings = require('./package.json');
const { sb2md } = require('./dist');

let stdin = '';

function usage() {
  console.log(`${settings.name} ${settings.version}
${settings.description}

Usage:
  sb2md [file]
  cat page.sb | sb2md`);
}

if (process.stdin.isTTY) {
  const file = process.argv[2];
  if (!file || file === '-h' || file === '--help') {
    usage();
    process.exit(file ? 0 : 1);
  }
  console.log(sb2md(fs.readFileSync(path.resolve(file), 'utf8')));
} else {
  process.stdin.on('readable', () => {
    const chunk = process.stdin.read();
    if (chunk !== null) {
      stdin += chunk;
    }
  })
  process.stdin.on('end', async () => {
    console.log(sb2md(stdin));
  })
}

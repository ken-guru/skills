import fs from 'fs';

const filePath = process.argv[2];
const keyPath = process.argv[3];
const valueStr = process.argv[4];

if (!filePath || !keyPath || !valueStr) {
  console.error("Usage: node inject-json.mjs <file> <key.path> <value_json>");
  process.exit(1);
}

// Simple comment stripper for JSONC
function stripJsonComments(data) {
  return data.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (match, group) => group ? "" : match);
}

let content = fs.readFileSync(filePath, 'utf8');
let obj = {};
try {
  obj = JSON.parse(stripJsonComments(content));
} catch (e) {
  console.error("Error parsing JSON:", e);
  process.exit(1);
}

const value = JSON.parse(valueStr);
const keys = [keyPath];
let current = obj;

for (let i = 0; i < keys.length - 1; i++) {
  if (current[keys[i]] === undefined) {
    current[keys[i]] = {};
  }
  current = current[keys[i]];
}

const lastKey = keys[keys.length - 1];

function pushIfNotExists(arr, item) {
  if (!arr.includes(item)) {
    arr.push(item);
  }
}

// If it's an array, append if not exists
if (Array.isArray(current[lastKey]) && Array.isArray(value)) {
  for (const item of value) {
    pushIfNotExists(current[lastKey], item);
  }
} else if (typeof current[lastKey] === 'object' && current[lastKey] !== null && typeof value === 'object' && !Array.isArray(value)) {
  current[lastKey] = { ...current[lastKey], ...value };
} else {
  // Otherwise overwrite or set
  if (Array.isArray(current[lastKey]) && !Array.isArray(value)) {
    pushIfNotExists(current[lastKey], value);
  } else {
    current[lastKey] = value;
  }
}

fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n');
console.log(`Successfully injected ${keyPath} into ${filePath}`);

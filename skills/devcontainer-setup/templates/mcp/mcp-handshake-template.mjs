#!/usr/bin/env node
// Template: verify an MCP server by completing a real `initialize`
// handshake over stdio, rather than just checking the binary exists.
//
// Usage: mcp-handshake-template.mjs <command> [args...]
// Exit 0 only once a well-formed `initialize` response is seen on the
// matching request id; exit non-zero on timeout, crash, or malformed
// response.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const [command, ...args] = process.argv.slice(2);
const timeoutMs = Number(process.env.MCP_HANDSHAKE_TIMEOUT_MS ?? 10_000);

if (!command) {
	console.error('Usage: mcp-handshake-template.mjs <command> [args...]');
	process.exit(2);
}

const child = spawn(command, args, {
	env: process.env,
	stdio: ['pipe', 'pipe', 'pipe']
});
let stderr = '';
let settled = false;

const finish = (exitCode, message) => {
	if (settled) return;
	settled = true;
	clearTimeout(timer);
	child.kill();
	if (message) console.error(message);
	process.exitCode = exitCode;
};

child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => {
	stderr += chunk;
});

child.on('error', (error) => {
	finish(1, `Handshake could not start ${command}: ${error.message}`);
});

child.on('exit', (code, signal) => {
	if (settled) return;
	const detail = stderr.trim();
	finish(
		1,
		`Server exited before initialize completed (${signal ?? `code ${code}`})${detail ? `: ${detail}` : ''}`
	);
});

const lines = createInterface({ input: child.stdout });
lines.on('line', (line) => {
	let message;
	try {
		message = JSON.parse(line);
	} catch {
		return; // Non-JSON stdout noise; ignore rather than fail.
	}

	// TODO: adjust these checks if your target protocol version's
	// response shape differs. The point is to verify a *specific*
	// well-formed response on the *matching* request id, not just any
	// stdout activity.
	if (
		message?.jsonrpc !== '2.0' ||
		message?.id !== 1 ||
		typeof message?.result?.protocolVersion !== 'string' ||
		typeof message?.result?.serverInfo?.name !== 'string'
	) {
		return;
	}

	child.stdin.write(
		`${JSON.stringify({
			jsonrpc: '2.0',
			method: 'notifications/initialized'
		})}\n`
	);
	child.stdin.end();
	finish(0);
});

const timer = setTimeout(() => {
	const detail = stderr.trim();
	finish(
		1,
		`Initialize handshake timed out after ${timeoutMs}ms${detail ? `: ${detail}` : ''}`
	);
}, timeoutMs);

child.stdin.write(
	`${JSON.stringify({
		jsonrpc: '2.0',
		id: 1,
		method: 'initialize',
		params: {
			// TODO: use the protocol version your target servers expect.
			protocolVersion: '2025-03-26',
			capabilities: {},
			clientInfo: {
				name: '<your-project-name>-mcp-health-check',
				version: '1.0.0'
			}
		}
	})}\n`
);

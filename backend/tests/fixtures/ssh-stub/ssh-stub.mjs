#!/usr/bin/env node
/**
 * Stub `ssh` client for Docker SSH transport tests.
 *
 * Stands in for the real binary so tests exercise argv construction, response
 * framing, failure classification and process cleanup without contacting any
 * host. NO TEST MAY EVER DIAL A REAL MACHINE — there is no CI, and the
 * reference host is someone's personal machine (research.md R7).
 *
 * Behaviour is selected by SSH_STUB_MODE:
 *   ok              — replay a 200 container listing
 *   ok-trailing     — 200 followed by the `context canceled` trailer
 *   version         — 200 /version payload
 *   http-400        — client-version rejection
 *   host-key        — host key verification failure
 *   auth            — authentication rejected
 *   unreachable     — no route to host
 *   no-docker       — remote docker CLI missing
 *   socket-denied   — remote user cannot access the docker socket
 *   hang            — accept input and never respond (timeout path)
 *
 * SSH_STUB_ARGV_OUT, when set, receives the received argv as JSON.
 */

import fs from 'node:fs';

const mode = process.env.SSH_STUB_MODE ?? 'ok';
const argvOut = process.env.SSH_STUB_ARGV_OUT;
if (argvOut) {
  fs.writeFileSync(argvOut, JSON.stringify(process.argv.slice(2)));
}

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

switch (mode) {
  case 'host-key':
    fail('Host key verification failed.', 255);
    break;
  case 'auth':
    fail('user@host: Permission denied (publickey).', 255);
    break;
  case 'unreachable':
    fail('ssh: connect to host host port 22: No route to host', 255);
    break;
  case 'no-docker':
    fail('bash: line 1: docker: command not found', 127);
    break;
  case 'socket-denied':
    fail(
      'Cannot connect to the Docker daemon at unix:///var/run/docker.sock: permission denied while trying to connect',
      1,
    );
    break;
  default:
    break;
}

function httpResponse(body, status = 200, statusText = 'OK') {
  return (
    `HTTP/1.1 ${status} ${statusText}\r\n` +
    'Api-Version: 1.52\r\n' +
    'Content-Type: application/json\r\n' +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
}

let received = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  received += chunk;
  if (!received.includes('\r\n\r\n')) return;
  if (mode === 'hang') return;

  const requestLine = received.split('\r\n')[0] ?? '';

  if (mode === 'http-400') {
    process.stdout.write(
      httpResponse(
        JSON.stringify({
          message: 'client version 1.24 is too old. Minimum supported API version is 1.44',
        }),
        400,
        'Bad Request',
      ),
    );
  } else if (requestLine.includes('/version')) {
    process.stdout.write(
      httpResponse(JSON.stringify({ ApiVersion: '1.52', MinAPIVersion: '1.44' })),
    );
  } else {
    process.stdout.write(httpResponse(JSON.stringify([])));
    if (mode === 'ok-trailing') {
      // The daemon emits this after the framed response on some routes; the
      // client must not treat it as body.
      process.stdout.write(JSON.stringify({ message: 'context canceled' }));
    }
  }

  process.stdout.end(() => process.exit(0));
});

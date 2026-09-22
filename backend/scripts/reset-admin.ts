#!/usr/bin/env tsx
/**
 * Break-glass script: Reset admin credentials without wiping the database.
 *
 * Usage:
 *   cd backend && npx tsx scripts/reset-admin.ts
 *   cd backend && npx tsx scripts/reset-admin.ts --username newadmin --password newpass
 *
 * If no flags are provided, prompts interactively via stdin.
 * Creates the admin user if no users exist (mirrors first-run).
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import argon2 from 'argon2';
import readline from 'node:readline';

const DATA_DIR = process.env['HOMEDASH_DATA_DIR'] || path.join(process.cwd(), 'data');
const DB_PATH = path.join(path.resolve(DATA_DIR), 'db', 'homedash.sqlite');

function parseArgs(): { username: string | undefined; password: string | undefined } {
  const args = process.argv.slice(2);
  let username: string | undefined;
  let password: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) username = args[++i];
    if (args[i] === '--password' && args[i + 1]) password = args[++i];
  }
  return { username, password };
}

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      process.stdout.write(question);
      const onData = (char: Buffer) => {
        const c = char.toString();
        if (c === '\n' || c === '\r') {
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          rl.close();
          resolve(answer);
        } else if (c === '\u007f' || c === '\b') {
          if (answer.length > 0) {
            answer = answer.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          answer += c;
          process.stdout.write('*');
        }
      };
      let answer = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    } else {
      rl.question(question, (ans) => {
        rl.close();
        resolve(ans);
      });
    }
  });
}

async function main() {
  console.log('\n🔑 HomeDash Admin Reset\n');

  const flags = parseArgs();

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  // Find the first admin user
  const admin = db
    .prepare("SELECT id, username FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")
    .get() as { id: string; username: string } | undefined;

  // Username: use flag if provided, otherwise keep existing (or prompt if no admin exists)
  let username: string;
  if (flags.username) {
    username = flags.username;
  } else if (admin) {
    username = admin.username;
    console.log(`  Keeping existing username: "${username}"`);
  } else {
    username = await prompt('New admin username: ');
  }

  const password = flags.password ?? (await prompt('New admin password: ', true));

  if (!username || username.length < 2) {
    console.error('❌ Username must be at least 2 characters.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('❌ Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const now = new Date().toISOString();

  if (admin) {
    db.prepare('UPDATE users SET username = ?, password_hash = ?, updated_at = ? WHERE id = ?').run(
      username,
      passwordHash,
      now,
      admin.id,
    );
    // Clear all sessions so old cookies are invalidated
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(admin.id);
    console.log(`✅ Admin "${admin.username}" reset → username: "${username}", password updated.`);
    console.log('   All existing sessions have been invalidated.');
  } else {
    // No users — create one (same as first-run)
    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO users (id, username, display_name, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, username, username, 'admin', passwordHash, now, now);
    console.log(`✅ Created new admin user: "${username}"`);
  }

  db.close();
  console.log('   Restart the server and log in with the new credentials.\n');
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});

/**
 * `web-ext run` with .webext-ff.cjs, plus one fix: the debugger connection is also retried on ECONNRESET.
 *
 * Under WSL2 mirrored networking a connect to a localhost port that nothing is listening on yet is answered with a
 * reset rather than a refusal, and web-ext only retries ECONNREFUSED (connectWithMaxRetries in
 * web-ext/lib/firefox/remote.js), so it gives up before Firefox has opened its debugger port.
 */

import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';

import webExt from 'web-ext';
import { consoleStream } from 'web-ext/util/logger';

const ProjectDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/*
 * Firefox exits at once as root in another user's session ("Running Firefox ... as root in a regular user's session is not
 * supported").  As root, re-run this script as the owner of the project directory, with that user's HOME and PATH.
 */
if(process.getuid?.() === 0) {
	let uid    = fs.statSync(ProjectDir).uid,
		passwd = execFileSync('getent', ['passwd', String(uid)], { encoding: 'utf8' }).trim().split(':'),
		[user, , , gid, , home] = passwd;

	if(uid === 0)
		throw new Error(`run-ff: ${ProjectDir} is owned by root, so there is no regular user to run Firefox as.`);

	console.log(`run-ff: running as ${user} instead of root`);

	let runtimeDir = `/run/user/${uid}`,
		env        = {
			...process.env,
			HOME:    home,
			USER:    user,
			LOGNAME: user,
			PATH:    `${home}/.local/bin:${process.env.PATH}`,
			...(fs.existsSync(runtimeDir) ? { XDG_RUNTIME_DIR: runtimeDir, DBUS_SESSION_BUS_ADDRESS: `unix:path=${runtimeDir}/bus` } : {}),
		};

	let result = spawnSync('runuser', ['-u', user, '--', process.execPath, ...process.argv.slice(1)], { cwd: ProjectDir, env, stdio: 'inherit' });

	if(result.error)
		throw new Error(`run-ff: could not run as ${user} (uid ${uid}, gid ${gid}) with runuser: ${result.error.message}`, { cause: result.error });
	process.exit(result.status ?? 1);
}

const require   = createRequire(import.meta.url);
const config    = require('../.webext-ff.cjs');
const RemoteJs  = path.join(path.dirname(require.resolve('web-ext')), 'lib/firefox/remote.js');
const { connect } = await import(pathToFileURL(RemoteJs).href);

// `npm run run-ff -- --verbose` also shows Firefox's own stderr, which is where a launch failure is explained
if(process.argv.includes('--verbose'))
	consoleStream.makeVerbose();

// Shells that WSL does not start itself (ssh, some IDE terminals) have no DISPLAY, and Firefox then exits without a word
if(!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && fs.existsSync('/mnt/wslg/.X11-unix/X0'))
	process.env.DISPLAY = ':0';

const MaxRetries    = 250,	// ~30s, matching web-ext's own limit
	  RetryInterval = 120;

async function firefoxClient({ port }) {
	for(let attempt = 0; ; attempt++) {
		try {
			return await connect(port);
		} catch(error) {
			if(!['ECONNREFUSED', 'ECONNRESET'].includes(error.code) || attempt >= MaxRetries)
				throw new Error(`Could not connect to the Firefox debugger on 127.0.0.1:${port} after ${attempt + 1} attempts: ${error.message}. `
					+ `Run 'npm run run-ff -- --verbose' to see Firefox's own output. If Firefox never opened a window, check that it can reach a display (DISPLAY=${process.env.DISPLAY || '<unset>'}, WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY || '<unset>'}).`, { cause: error });
			await new Promise(resolve => setTimeout(resolve, RetryInterval));
		}
	}
}

await webExt.cmd.run({ sourceDir: config.sourceDir, ...config.run, noInput: !process.stdin.isTTY }, { firefoxClient, shouldExitProgram: false });

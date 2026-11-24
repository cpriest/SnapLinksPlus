/**
 * `web-ext run` for one browser, with the options in .webext-run.cjs:
 *
 *   node scripts/run-browser.mjs firefox|chrome|edge [--windows] [--verbose]
 *
 * --windows, under WSL: runs this script with the Windows node.exe, so the Windows build of the browser starts.  web-ext
 * gives the browser paths (profile, extension) of the system it runs on, so a Linux node cannot start a Windows browser.
 *
 * For Firefox, the debugger connection is also retried on ECONNRESET.  Under WSL2 mirrored networking a connect to a
 * localhost port that nothing is listening on yet is answered with a reset rather than a refusal, and web-ext only retries
 * ECONNREFUSED (connectWithMaxRetries in web-ext/lib/firefox/remote.js), so it gives up before Firefox has opened its debugger port.
 */

import { execFileSync, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ProjectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
	  Args       = process.argv.slice(2),
	  Browser    = Args.find(arg => !arg.startsWith('--')),
	  Script     = `run-browser ${Browser}`;

const require = createRequire(import.meta.url);
const configs = require('../.webext-run.cjs');

if(!configs[Browser])
	throw new Error(`run-browser: unknown browser '${Browser ?? ''}', use one of: ${Object.keys(configs).join(', ')}`);

/*
 * --windows under WSL: run this script again with the Windows node.exe.  It reads the project over \\wsl.localhost, where
 * file change events do not arrive, so the watch for a rebuild polls (WATCHPACK_POLLING, passed to Windows by WSLENV).
 *
 * WSL ends a Windows process on Ctrl+C without a signal it can handle, and web-ext then leaves the browser open.  So node.exe
 * runs in its own process group, out of reach of Ctrl+C, and this one tells it to stop by closing its stdin (RUN_BROWSER_STDIN_STOPS).
 */
if(Args.includes('--windows') && process.platform == 'linux') {
	let nodeExe = process.env.WINDOWS_NODE || '/mnt/c/Program Files/nodejs/node.exe';

	if(!fs.existsSync(nodeExe))
		throw new Error(`${Script}: --windows needs the Windows node.exe, which is not at ${nodeExe}; install Node.js on Windows or set WINDOWS_NODE to its node.exe`);

	let windowsPath = file => execFileSync('wslpath', ['-w', file], { encoding: 'utf8' }).trim(),
		child       = spawn(nodeExe, [windowsPath(fileURLToPath(import.meta.url)), ...Args.filter(arg => arg != '--windows')], {
			cwd:      ProjectDir,
			env:      { ...process.env, WATCHPACK_POLLING: '500', RUN_BROWSER_STDIN_STOPS: '1', WSLENV: [process.env.WSLENV, 'WATCHPACK_POLLING', 'RUN_BROWSER_STDIN_STOPS'].filter(Boolean).join(':') },
			stdio:    ['pipe', 'inherit', 'inherit'],
			detached: true,
		});

	for(let signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
		process.on(signal, () => child.stdin.end());
	child.on('error', error => { throw new Error(`${Script}: could not start ${nodeExe}: ${error.message}`, { cause: error }); });
	child.on('exit', code => process.exit(code ?? 1));
	await new Promise(() => {});	// Never settles: this process ends when the child does
}

/*
 * Firefox exits at once as root in another user's session ("Running Firefox ... as root in a regular user's session is not
 * supported"), and Chrome refuses root without --no-sandbox.  As root, re-run this script as the owner of the project directory,
 * with that user's HOME and PATH.
 */
if(process.getuid?.() === 0) {
	let uid    = fs.statSync(ProjectDir).uid,
		passwd = execFileSync('getent', ['passwd', String(uid)], { encoding: 'utf8' }).trim().split(':'),
		[user, , , gid, , home] = passwd;

	if(uid === 0)
		throw new Error(`${Script}: ${ProjectDir} is owned by root, so there is no regular user to run the browser as.`);

	console.log(`${Script}: running as ${user} instead of root`);

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
		throw new Error(`${Script}: could not run as ${user} (uid ${uid}, gid ${gid}) with runuser: ${result.error.message}`, { cause: result.error });
	process.exit(result.status ?? 1);
}

const config                = configs[Browser],
	  { default: webExt }   = await import('web-ext'),
	  { consoleStream }     = await import('web-ext/util/logger');

// `--verbose` also shows the browser's own stderr, which is where a launch failure is explained
if(Args.includes('--verbose'))
	consoleStream.makeVerbose();

// Shells that WSL does not start itself (ssh, some IDE terminals) have no DISPLAY, and the browser then exits without a word
if(!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && fs.existsSync('/mnt/wslg/.X11-unix/X0'))
	process.env.DISPLAY = ':0';

/**
 * Firefox runs content scripts on file:// pages only after the user allows it, so the test fixtures are served over http instead.
 * Only test/ is served: the project root also holds insecure/ (signing keys).
 *
 * @return {Promise<string>}  The base URL, eg: http://127.0.0.1:41234/
 */
async function serveTestDir() {
	const Root  = path.join(ProjectDir, 'test'),
		  Types = { '.html': 'text/html', '.htm': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.gif': 'image/gif', '.png': 'image/png', '.svg': 'image/svg+xml' };

	let server = http.createServer((req, res) => {
		let pathname = new URL(req.url, 'http://x').pathname,
			file     = path.join(Root, path.normalize(decodeURIComponent(pathname)));

		if(pathname === '/') {
			res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(testIndex(Root));
			return;
		}
		if(!file.startsWith(Root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
			res.writeHead(404).end(`${Script}: ${req.url} is not a file in ${Root}`);
			return;
		}
		res.writeHead(200, { 'Content-Type': Types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
		fs.createReadStream(file).pipe(res);
	});

	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	return `http://127.0.0.1:${server.address().port}/`;
}

/**
 * The page served at /: a link to each fixture page in test/, with its <title>. Built per request, so new pages appear without a restart.
 *
 * @param {string} root    The test/ directory
 * @return {string}
 */
function testIndex(root) {
	const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

	let rows = fs.readdirSync(root)
		.filter(f => /\.html?$/i.test(f))
		.sort()
		.map(f => {
			let title = fs.readFileSync(path.join(root, f), 'utf8').match(/<title>([^<]*)<\/title>/i)?.[1].trim() || '';
			return `<li><a href="${encodeURIComponent(f)}">${esc(f)}</a>${title ? ` <span>${esc(title)}</span>` : ''}</li>`;
		});

	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Snap Links test pages</title>
<style>body { font: 16px sans-serif; margin: 20px; } li { margin: 6px 0; } span { color: #666; margin-left: 10px; }</style></head>
<body><h2>Snap Links test pages</h2><p>Served from <code>${esc(root)}</code></p><ul>
${rows.join('\n')}
</ul></body></html>`;
}

const MaxRetries    = 250,	// ~30s, matching web-ext's own limit
	  RetryInterval = 120;

/**
 * Ends the Windows processes that run the profile.  web-ext ends only the process it started, and on Windows that is
 * Firefox's launcher process, which has started the browser as another process.
 *
 * @param {string} profile    The profile directory
 */
function closeProfileProcesses(profile) {
	let command = `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains('${profile.replaceAll("'", "''")}') }`
		+ ' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';

	try {
		execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'ignore' });
	} catch(error) {
		console.error(`${Script}: could not close the browser processes that use ${profile}: ${error.message}`);
	}
}

/** web-ext's connect to the Firefox debugger, also retried on ECONNRESET (see the top of this file) */
async function firefoxClient({ port }) {
	const RemoteJs    = path.join(path.dirname(require.resolve('web-ext')), 'lib/firefox/remote.js'),
		  { connect } = await import(pathToFileURL(RemoteJs).href);

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

// web-ext makes only the last directory of a missing profile path
fs.mkdirSync(path.dirname(config.run.firefoxProfile ?? config.run.chromiumProfile), { recursive: true });

if(Browser == 'firefox') {
	/*
	 * Firefox caches each add-on's parsed manifest by id + version and keeps it when Firefox quits. Every run installs the same
	 * version, so a manifest change (eg: a new optional permission) would be ignored in favor of the cached copy until the add-on
	 * is reloaded. The profile is for development only, so drop the cache before each start.
	 */
	fs.rmSync(path.join(config.run.firefoxProfile, 'startupCache', 'webext.sc.lz4'), { force: true });
} else {
	if(!config.run.chromiumBinary && (Browser == 'edge' || process.platform == 'linux'))
		throw new Error(`${Script}: the ${Browser} binary was not found; install it, set ${Browser.toUpperCase()} to its path, or under WSL use --windows`);
	// web-ext keeps a Chromium profile only once it exists
	fs.mkdirSync(config.run.chromiumProfile, { recursive: true });
}

let runner = await webExt.cmd.run(
	{ sourceDir: config.sourceDir, ...config.run, startUrl: [await serveTestDir()], noInput: !process.stdin.isTTY },
	{ shouldExitProgram: false, ...(Browser == 'firefox' ? { firefoxClient } : {}) },
);

/*
 * Close the browser on SIGINT, or under --windows when the Linux side closes stdin (see the top of this file).  On Windows
 * web-ext ends only Firefox's launcher process, so the processes that run the profile are ended too.
 */
let stop = () => runner.exit().finally(() => {
	if(process.platform == 'win32')
		closeProfileProcesses(config.run.firefoxProfile ?? config.run.chromiumProfile);
	process.exit(130);
});

process.once('SIGINT', stop);
if(process.env.RUN_BROWSER_STDIN_STOPS)
	process.stdin.on('end', stop).resume();

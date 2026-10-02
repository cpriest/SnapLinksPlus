/**
 * `web-ext run` with .webext-ff.cjs, plus one fix: the debugger connection is also retried on ECONNRESET.
 *
 * Under WSL2 mirrored networking a connect to a localhost port that nothing is listening on yet is answered with a
 * reset rather than a refusal, and web-ext only retries ECONNREFUSED (connectWithMaxRetries in
 * web-ext/lib/firefox/remote.js), so it gives up before Firefox has opened its debugger port.
 */

import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';

import webExt from 'web-ext';

const require   = createRequire(import.meta.url);
const config    = require('../.webext-ff.cjs');
const RemoteJs  = path.join(path.dirname(require.resolve('web-ext')), 'lib/firefox/remote.js');
const { connect } = await import(pathToFileURL(RemoteJs).href);

const MaxRetries    = 250,	// ~30s, matching web-ext's own limit
	  RetryInterval = 120;

async function firefoxClient({ port }) {
	for(let attempt = 0; ; attempt++) {
		try {
			return await connect(port);
		} catch(error) {
			if(!['ECONNREFUSED', 'ECONNRESET'].includes(error.code) || attempt >= MaxRetries)
				throw new Error(`Could not connect to the Firefox debugger on 127.0.0.1:${port} after ${attempt + 1} attempts: ${error.message}`, { cause: error });
			await new Promise(resolve => setTimeout(resolve, RetryInterval));
		}
	}
}

await webExt.cmd.run({ sourceDir: config.sourceDir, ...config.run, noInput: !process.stdin.isTTY }, { firefoxClient, shouldExitProgram: false });

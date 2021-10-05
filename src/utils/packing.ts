import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { MyError } from './common';
import { addCleanUpTask } from './cleanup';

const a7zipBin = process.env['PATH']?.toLowerCase().includes('7-zip') ? 
	'7z'
	: path.join(process.env['ProgramFiles'] || '', '7-Zip', '7z.exe')
;

// Test is 7-Zip present
execFile(a7zipBin, [], {}, (error, stdout, stderr) => {
	if (error) {
		console.error(`7-Zip was not found. Please install 7-Zip and make sure it's accessible in PATH environment variable.`);
		console.error(error);
		process.exit(65);
	}
})

// TODO: include more accurate progress reporting from 7zip
// See https://stackoverflow.com/questions/21144140/how-to-show-extraction-progress-of-7zip-inside-cmd

export const getSafeTemporaryDirectory = async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stellaris-'));
	addCleanUpTask(async () => {
		try {
			console.debug(`cleaning up temporary directory ${directory}`);
			await fs.rm(directory, { recursive: true });
		}
		catch (error) {
			console.warn(`warning: couldn't clean up temporary directory`);
			console.debug(error);
		}
	});
	return directory;
}

export const unpackSaveIntoTemporaryFiles = async (saveFilePath: string, directory: string = '', showLogs: boolean = false) => {
	directory ||= await getSafeTemporaryDirectory();
	return new Promise<string>((resolve, reject) => {
		const a7zipProcess = execFile(a7zipBin, ['e', saveFilePath, `-o${directory}`, '-y'], {}, (error, stdout, stderr) => {
			if (error) {
				reject(new MyError('unpacking-error', `Error occurred while unpacking save file.`, error));
			}
			resolve(directory);
		});
		if (showLogs) {
			a7zipProcess.stdout?.pipe(process.stdout);
			a7zipProcess.stderr?.pipe(process.stderr);
		}
	});
};

export const packTemporaryFilesIntoSave = async (saveFilePath: string, directory: string, showLogs: boolean = false) => {
	const files = ['meta', 'gamestate'].map(n => path.join(directory, n));
	return new Promise<string>((resolve, reject) => {
		const a7zipProcess = execFile(a7zipBin, ['a', saveFilePath, '-tZip', '-mm=Deflate', '-mtc=off'].concat(files), {}, (error, stdout, stderr) => {
			if (error) {
				reject(new MyError('packing-error', `Error occurred while packing save file.`, error));
			}
			resolve(saveFilePath);
		});
		if (showLogs) {
			a7zipProcess.stdout?.pipe(process.stdout);
			a7zipProcess.stderr?.pipe(process.stderr);
		}
	});
}

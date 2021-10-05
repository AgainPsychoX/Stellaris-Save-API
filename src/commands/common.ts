import path from 'path';
import { Command } from 'commander';
import { selectLatestSaveFile, selectSaveFileByString, selectSaveFilePrompt } from '@/utils/selectingSave';
import StellarisSave from '@/StellarisSave';
import { MyError } from '@/utils/common';

export const addSaveFileInputHandlingToCommand = (
	command: Command, 
	settings: {
		/**
		 * If true, allows using interactive prompt to select save file,
		 * if no other specifier was provided.
		 */
		interactive?: boolean,
		/**
		 * If true, error will be reported and program will exit if input file
		 * does not exist or is not accessible.
		 */
		require?: boolean, 
		/**
		 * If set as number, specifies that argument will be use as general 
		 * specifier for selecting input save file (path, name, 'latest' etc.).
		 * 
		 * If set as true, latest argument will be used.
		 */
		useArgument?: number | true
	} = {}
) => {
	settings = Object.assign({ interactive: false, require: true, useArgument: undefined }, settings);
	if (settings.useArgument) {
		command.argument('[savePath]', 'input save file path (can be relative to saves directory)');
	}

	command
		.option('-i, --input <savePath>', 'input save file path (can be relative to save directory)')
		.option('-l, --latest', `work with latest played save file`)
		// TODO: add forcing interactive prompt for input select
		.hook('preAction', async (thisCommand, actionCommand) => {
			const options = actionCommand.opts();

			let providedPath = options.input;
			if (settings.useArgument) {
				if (settings.useArgument === true) {
					settings.useArgument = actionCommand.processedArgs.length - 1;
				}
				providedPath ||= actionCommand.processedArgs[settings.useArgument] as string;
			}

			let inputFilePath: string | undefined;
			if (providedPath) {
				try {
					inputFilePath = await selectSaveFileByString(providedPath);
				}
				catch (error) {
					if (providedPath.toLowerCase() === 'latest') {
						try {
							inputFilePath = await selectLatestSaveFile();
						}
						catch (error) {
							process.exitCode = 2;
							throw error;
						}
					}
					else {
						throw error;
					}
				}
			}
			if (options.latest) {
				try {
					inputFilePath = await selectLatestSaveFile();
				}
				catch (error) {
					process.exitCode = 2;
					throw error;
				}
			}
			if (!inputFilePath && settings.interactive) {
				inputFilePath = await selectSaveFilePrompt();
			}
			if (!inputFilePath && settings.require) {
				process.exitCode = 2;
				throw new MyError('input-not-specified', `Input file must be specified.`);
			}

			if (settings.useArgument) {
				actionCommand.processedArgs[settings.useArgument] = inputFilePath;
			}
			actionCommand.setOptionValue('input', inputFilePath);
		})
	;
}

const stripFromSavExt = (path: string) => {
	const i = path.toLowerCase().lastIndexOf('.sav');
	if (i === -1 || i !== path.length - 4) {
		return path;
	}
	else {
		return path.substring(0, i);
	}
}
const ensureSavExt = (path: string) => {
	if (path.toLowerCase().endsWith('.sav')) {
		return path;
	}
	else {
		return path + '.sav';
	}
}

export const addSaveFileOutputHandlingToCommand = (
	command: Command, 
	settings: { interactive?: boolean, require?: boolean } = {}
) => {
	settings = Object.assign({ interactive: false, require: false }, settings);

	// Basic `--output`
	command
		.option('-o, --output <savePath>', `output save file path`)
	;

	// Conditionally add options that rely on input option
	if ((command as any)._findOption('--input')) {
		command
			.option('--in-place', 'overwrite input save file with output file')
			.option('--output-suffix [suffix]', `output save file path is the same as input file, but with suffix (it's default, with 'out' suffix)`)
			.option('--output-next-to-input <name>', `output save file path is file next to input file, using specified name.`)
		;
	}

	// Hook logic
	command
		.hook('preAction', async (thisCommand, actionCommand) => {
			const options = actionCommand.opts();

			let outputFilePath: string | undefined;
			if (options.output) {
				outputFilePath =  options.output;
			}
			if (options.input) {
				if (options.inPlace) {
					outputFilePath = options.input;
				}
				else if (options.outputSuffix) {
					const suffix = typeof options.outputSuffix === 'string' ? options.outputSuffix : '.out';
					outputFilePath = ensureSavExt(stripFromSavExt(options.input) + suffix);
				}
				else if (options.outputNextToInput) {
					outputFilePath = ensureSavExt(path.join(options.input, '../', options.outputNextToInput));
				}
			}
			else {
				if (!outputFilePath) {
					if (options.inPlace || options.outputSuffix || options.outputNextToInput) {
						throw new MyError('output-specified-invalidly', `Output file is specified invalidly, basing on missing input file path.`);
					}
				}
			}
			if (!outputFilePath && settings.interactive) {
				// TODO: interactive save output location picker? with default '.out'
			}
			if (!outputFilePath) {
				if (settings.require) {
					process.exitCode = 2;
					throw new MyError('output-not-specified', `Output file must be specified.`);
				}
				outputFilePath = ensureSavExt(stripFromSavExt(options.input) + '.out');
			}

			actionCommand.setOptionValue('output', outputFilePath);
		})
	;
}

export const loadSaveFileFancy = async (inputFilePath: string) => {
	let lastReportDate = Date.now();
	const reportProgress = (step: number, maxSteps: number) => {
		if (Date.now() - lastReportDate > 100) {
			process.stdout.clearLine(0);
			process.stdout.cursorTo(0);
			process.stdout.write(`Loading save file: ${(step / maxSteps * 100).toFixed(1)}% (${step}/${maxSteps})`);
			process.stdout.cursorTo(0);
			lastReportDate = Date.now();
		}
	}
	const reportMessage = (message: string) => {
		process.stdout.clearLine(0);
		process.stdout.cursorTo(0);
		console.log(message);
	}
	const save = await StellarisSave.loadFromFile(inputFilePath, reportProgress, reportMessage);
	process.stdout.clearLine(0);
	process.stdout.cursorTo(0);
	console.log(`Loaded save file: ${save.name} ${save.date} ${save.version}`);
	return save;
}

export const saveSaveFileFancy = async (outputFilePath: string, save: StellarisSave) => {
	const reportMessage = (message: string) => {
		process.stdout.clearLine(0);
		process.stdout.cursorTo(0);
		console.log(message);
	}
	process.stdout.clearLine(0);
	process.stdout.cursorTo(0);
	console.log(`Saved save file: ${outputFilePath}`)
	await save.saveToFile(outputFilePath, undefined, reportMessage);
	// TODO: fancier saving, with progress bar, nice messages and stuff
}

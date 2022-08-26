
import { Command, Option } from "commander";
import registerCombatTestCommand from "./commands/CombatTestCommand";
import registerInteractiveCommand from "./commands/InteractiveCommand";
import registerListCommand from "./commands/ListCommand";
import { registerPackCommand, registerUnpackCommand } from "./commands/PackingCommands";
import registerPrecursorsCommand from "./commands/PrecursorsCommand";
import registerReportCommand from "./commands/ReportCommand";
import { runCleanUpTasks } from "./utils/cleanup";
import { MyError } from "./utils/common";
import { setGameDirectory } from "./utils/gameData";
import { setupLogging } from "./utils/logging";

if (process.platform != 'win32') {
	console.error('Only Windows is supported for now!')
	process.exit(1);
}

const program = new Command();
program
	.name('ssa-cli')
	.version('0.1.0')
	.description('Set of tools to work with Stellaris save files.')
	.addOption(
		new Option('-d, --debug', 'output extra debugging info')
			.default(false)
			.env('DEBUG')
	)
	.addOption(
		new Option('--debug-except <exceptions>', 'output extra debugging info with exception for comma-separated list of named loggers')
			.default(false)
			.argParser(s => s && s.split(','))
			.env('DEBUG_EXCEPT')
			.implies({ debug: true })
			.hideHelp()
	)
	// TODO: 
	// .option('--saves-directory <path>', 'set custom saves directory')
	.option('--game-directory <path>', 'set path to game directory (if not specified, tries to detect or continue without)')
	.hook('preAction', async (thisCommand, actionCommand) => {
		const options = thisCommand.opts();

		// Ignore debug output if no debug flag specified
		setupLogging(!!options.debug, options.debugExcept);

		if (options.gameDirectory) {
			await setGameDirectory(options.gameDirectory);
		}
	})
;

registerListCommand(program);
registerPackCommand(program);
registerUnpackCommand(program);
registerInteractiveCommand(program);
registerPrecursorsCommand(program);
registerReportCommand(program);
registerCombatTestCommand(program);

program
	.parseAsync(process.argv)
	.catch(error => {
		console.error(error);
		switch ((error as MyError).code) {
			case 'no-game-directory':
				console.error(`Use '--game-directory' option to provide custom path.`);
				break;
		}
	})
	.finally(async () => {
		runCleanUpTasks();
	})
;

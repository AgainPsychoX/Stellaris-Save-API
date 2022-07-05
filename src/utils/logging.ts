import { Console } from "console";
import { stderr, stdout } from "process";

type LoggerKey = string | symbol;
type Logger = Console;

type TDebugFunction = (message?: any, ...optionalParams: any[]) => void;
type OriginalFunctionHolder = { _original_debug: TDebugFunction };
const nop = (..._: any[]) => void(0);
const disableDebugForLogger = (logger: Logger) => {
	if (logger.debug == nop) return;
	(logger as unknown as OriginalFunctionHolder)._original_debug = logger.debug;
	logger.debug = nop;
}
const enableDebugForLogger = (logger: Logger) => {
	if (logger.debug != nop) return;
	logger.debug = (logger as unknown as OriginalFunctionHolder)._original_debug;
}

let debugOutputExceptions: LoggerKey[] = [];
let debugOutputEnabled = true;
const loggers: Record<LoggerKey, Logger> = {};

export const setupLogging = (debugEnabled: boolean, exceptions?: LoggerKey[]) => {
	debugOutputExceptions = exceptions || [];
	if (debugEnabled) {
		enableDebugForLogger(console);
		for (const [key, logger] of Object.entries(loggers)) {
			if (debugOutputExceptions.includes(key)) {
				disableDebugForLogger(logger);
			}
			else {
				enableDebugForLogger(logger);
			}
		}
	}
	else {
		disableDebugForLogger(console);
		for (const logger of Object.values(loggers)) {
			disableDebugForLogger(logger);
		}
	}
}

const prepareNewLogger = (key: LoggerKey): Logger => {
	const instance = new Console(stderr, stdout);
	if (!debugOutputEnabled || debugOutputExceptions.includes(key)) {
		disableDebugForLogger(console);
	}
	return instance;
}

export const getLogger = (key: LoggerKey) => {
	return loggers[key] ||= prepareNewLogger(key);
}

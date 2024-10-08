import { extendConfig, extendEnvironment, extendProvider } from "hardhat/config";
import "./type-extensions";

////////////////////////////////////////////////////////////////////////////////
// HH Plugin Config
////////////////////////////////////////////////////////////////////////////////

import { configExtender } from "./internal/ConfigExtender";
extendConfig(configExtender);

import { envExtender } from "./internal/EnvironmentExtender";
extendEnvironment(envExtender);

import { providerExtender } from "./internal/ProviderExtender";
extendProvider(providerExtender);

////////////////////////////////////////////////////////////////////////////////
// Tasks
////////////////////////////////////////////////////////////////////////////////

import "./tasks/fhevm";
import "./tasks/local-fhevm";
import "./tasks/builtin-tasks";

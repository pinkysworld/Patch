import core from './offline-studio-build-bridge-core.cjs';
import { buildNativeGuiForHost } from './native-gui-host.js';

export const OFFLINE_BUILD_BRIDGE_PROTOCOL = core.OFFLINE_BUILD_BRIDGE_PROTOCOL;
export const OFFLINE_BUILD_BRIDGE_PATH = core.OFFLINE_BUILD_BRIDGE_PATH;
export const OFFLINE_BUILD_BRIDGE_MAX_BODY = core.OFFLINE_BUILD_BRIDGE_MAX_BODY;
export const OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL = core.OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL;
export const OFFLINE_WORKSPACE_SNAPSHOT_PATH = core.OFFLINE_WORKSPACE_SNAPSHOT_PATH;
export const OFFLINE_WORKSPACE_SNAPSHOT_MAX_BODY = core.OFFLINE_WORKSPACE_SNAPSHOT_MAX_BODY;
export const OFFLINE_BUILD_ARTIFACT_PREFIX = core.OFFLINE_BUILD_ARTIFACT_PREFIX;
export const OfflineBuildBridgeError = core.OfflineBuildBridgeError;

export const validateOfflineBuildRequest = core.validateOfflineBuildRequest;
export const validateOfflineWorkspaceSnapshot = core.validateOfflineWorkspaceSnapshot;
export const resolveOpenedWorkspace = core.resolveOpenedWorkspace;
export const resolveOfflineBuildWorkspace = core.resolveOfflineBuildWorkspace;
export const materializeOfflineWorkspaceSnapshot = core.materializeOfflineWorkspaceSnapshot;

export function executeOfflineBuildRequest(workspaceRoot, value, options = {}) {
  return core.executeOfflineBuildRequest(workspaceRoot, value, {
    ...options,
    builder: options.builder ?? buildNativeGuiForHost
  });
}

export function createOfflineBuildRequestHandler(options = {}) {
  return core.createOfflineBuildRequestHandler({
    ...options,
    builder: options.builder ?? buildNativeGuiForHost
  });
}

export function createOfflineBuildBridge(options = {}) {
  return core.createOfflineBuildBridge({
    ...options,
    builder: options.builder ?? buildNativeGuiForHost
  });
}

export function startOfflineBuildBridge(options = {}) {
  return core.startOfflineBuildBridge({
    ...options,
    builder: options.builder ?? buildNativeGuiForHost
  });
}

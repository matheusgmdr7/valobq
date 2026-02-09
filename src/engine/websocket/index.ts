/**
 * WebSocket Module - Exports
 */

export { WebSocketClient, WebSocketStatus, type WebSocketConfig, type MarketDataMessage, type MessageHandler, type StatusChangeHandler, type ErrorHandler } from './WebSocketClient';
export { MarketDataParser, type ParsedCandle, type ParsedTick } from './MarketDataParser';
export { PollingFallback, type PollingConfig, type PollingOptions } from './PollingFallback';
export { RealtimeDataManager, type RealtimeDataConfig, type DataUpdateHandler, type StatusChangeHandler as RealtimeStatusChangeHandler } from './RealtimeDataManager';
export { DataValidator, type ValidationResult, type DataQualityMetrics } from './DataValidator';


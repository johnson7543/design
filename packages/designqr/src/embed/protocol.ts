import type {
  DesignQRConfigV1,
  DesignQRErrorCode,
  DesignQRView,
} from '../config/types.ts';

export const DESIGN_QR_MESSAGE_SOURCE = 'designqr' as const;
export const DESIGN_QR_PROTOCOL_VERSION = 1 as const;
export const DESIGN_QR_MAX_EXPORT_BYTES = 16 * 1024 * 1024;

export type DesignQRParentMessageType =
  | 'designqr:connect'
  | 'designqr:set-config'
  | 'designqr:set-view'
  | 'designqr:pause'
  | 'designqr:resume'
  | 'designqr:reset-rotation'
  | 'designqr:export-image';

export type DesignQRChildMessageType =
  | 'designqr:ready'
  | 'designqr:view-change'
  | 'designqr:error'
  | 'designqr:export-result'
  | 'designqr:export-error';

export type DesignQRMessageType =
  | DesignQRParentMessageType
  | DesignQRChildMessageType;

interface DesignQRMessageEnvelope<
  TType extends DesignQRMessageType = DesignQRMessageType,
> {
  source: typeof DESIGN_QR_MESSAGE_SOURCE;
  protocolVersion: typeof DESIGN_QR_PROTOCOL_VERSION;
  instanceId: string;
  type: TType;
}

export type DesignQRMessage<
  TType extends DesignQRMessageType = DesignQRMessageType,
  TPayload = undefined,
> = DesignQRMessageEnvelope<TType> & (
  TPayload extends undefined
    ? { payload?: undefined }
    : { payload: TPayload }
);

export interface DesignQREmbedErrorPayload {
  code: DesignQRErrorCode | 'INVALID_MESSAGE' | 'EXPORT_TOO_LARGE';
  message: string;
}

export type DesignQRParentMessage =
  | DesignQRMessage<'designqr:connect'>
  | DesignQRMessage<'designqr:set-config', { config: DesignQRConfigV1 }>
  | DesignQRMessage<'designqr:set-view', { view: DesignQRView }>
  | DesignQRMessage<'designqr:pause'>
  | DesignQRMessage<'designqr:resume'>
  | DesignQRMessage<'designqr:reset-rotation'>
  | DesignQRMessage<'designqr:export-image', { requestId: string }>;

export type DesignQRChildMessage =
  | DesignQRMessage<'designqr:ready', { view: DesignQRView }>
  | DesignQRMessage<'designqr:view-change', { view: DesignQRView }>
  | DesignQRMessage<'designqr:error', { error: DesignQREmbedErrorPayload }>
  | DesignQRMessage<
      'designqr:export-result',
      { requestId: string; blob: Blob }
    >
  | DesignQRMessage<
      'designqr:export-error',
      { requestId: string; error: DesignQREmbedErrorPayload }
    >;

const INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ERROR_CODES: ReadonlySet<string> = new Set<DesignQREmbedErrorPayload['code']>([
  'INVALID_CONFIG',
  'UNSUPPORTED_DESIGN',
  'QR_GENERATION_FAILED',
  'LOGO_LOAD_FAILED',
  'WEBGL_UNAVAILABLE',
  'WEBGL_CONTEXT_LOST',
  'EXPORT_FAILED',
  'INVALID_MESSAGE',
  'EXPORT_TOO_LARGE',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isView(value: unknown): value is DesignQRView {
  return value === 'design' || value === 'qr';
}

function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

function isErrorPayload(value: unknown): value is DesignQREmbedErrorPayload {
  if (!isRecord(value)) return false;
  return typeof value.code === 'string'
    && ERROR_CODES.has(value.code)
    && typeof value.message === 'string'
    && value.message.length > 0
    && value.message.length <= 512;
}

function isEnvelope(
  value: unknown
): value is DesignQRMessageEnvelope & { payload?: unknown } {
  if (!isRecord(value)) return false;
  return value.source === DESIGN_QR_MESSAGE_SOURCE
    && value.protocolVersion === DESIGN_QR_PROTOCOL_VERSION
    && typeof value.instanceId === 'string'
    && (value.instanceId === '*' || INSTANCE_ID_PATTERN.test(value.instanceId))
    && typeof value.type === 'string';
}

function hasNoPayload(
  message: DesignQRMessageEnvelope & { payload?: unknown }
): boolean {
  return message.payload === undefined;
}

export function isDesignQRInstanceId(value: unknown): value is string {
  return typeof value === 'string' && INSTANCE_ID_PATTERN.test(value);
}

export function createDesignQRInstanceId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `dqr_${randomUuid.replaceAll('-', '')}`;

  const random = Math.random().toString(36).slice(2);
  return `dqr_${Date.now().toString(36)}_${random}`;
}

export function createDesignQRRequestId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `req_${randomUuid.replaceAll('-', '')}`;

  const random = Math.random().toString(36).slice(2);
  return `req_${Date.now().toString(36)}_${random}`;
}

export function createDesignQRMessage<TType extends DesignQRMessageType>(
  instanceId: string,
  type: TType
): DesignQRMessage<TType>;
export function createDesignQRMessage<
  TType extends DesignQRMessageType,
  TPayload,
>(
  instanceId: string,
  type: TType,
  payload: TPayload
): DesignQRMessage<TType, TPayload>;
export function createDesignQRMessage<
  TType extends DesignQRMessageType,
  TPayload,
>(
  instanceId: string,
  type: TType,
  payload?: TPayload
): DesignQRMessage<TType, TPayload | undefined> {
  const envelope: DesignQRMessageEnvelope<TType> = {
    source: DESIGN_QR_MESSAGE_SOURCE,
    protocolVersion: DESIGN_QR_PROTOCOL_VERSION,
    instanceId,
    type,
  };

  return (payload === undefined
    ? envelope
    : { ...envelope, payload }) as DesignQRMessage<TType, TPayload | undefined>;
}

export function isDesignQRParentMessage(
  value: unknown
): value is DesignQRParentMessage {
  if (!isEnvelope(value)) return false;
  if (value.instanceId === '*' && value.type !== 'designqr:connect') return false;

  switch (value.type) {
    case 'designqr:connect':
      return hasNoPayload(value);
    case 'designqr:set-config':
      return isRecord(value.payload) && isRecord(value.payload.config);
    case 'designqr:set-view':
      return isRecord(value.payload) && isView(value.payload.view);
    case 'designqr:pause':
    case 'designqr:resume':
    case 'designqr:reset-rotation':
      return hasNoPayload(value);
    case 'designqr:export-image':
      return isRecord(value.payload) && isRequestId(value.payload.requestId);
    default:
      return false;
  }
}

export function isDesignQRChildMessage(
  value: unknown
): value is DesignQRChildMessage {
  if (!isEnvelope(value) || value.instanceId === '*') return false;

  switch (value.type) {
    case 'designqr:ready':
    case 'designqr:view-change':
      return isRecord(value.payload) && isView(value.payload.view);
    case 'designqr:error':
      return isRecord(value.payload) && isErrorPayload(value.payload.error);
    case 'designqr:export-result':
      return isRecord(value.payload)
        && isRequestId(value.payload.requestId)
        && typeof Blob !== 'undefined'
        && value.payload.blob instanceof Blob;
    case 'designqr:export-error':
      return isRecord(value.payload)
        && isRequestId(value.payload.requestId)
        && isErrorPayload(value.payload.error);
    default:
      return false;
  }
}

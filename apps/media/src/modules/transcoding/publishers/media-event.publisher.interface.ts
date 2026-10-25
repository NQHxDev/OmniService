import type { ITranscodeCompletedEvent, ITranscodeFailedEvent, ITranscodeRequestedEvent } from '@contracts/media';

export const MEDIA_EVENT_PUBLISHER = Symbol('MEDIA_EVENT_PUBLISHER');

export interface IMediaEventPublisher {
   publishTranscodeRequested(event: ITranscodeRequestedEvent): Promise<void>;
   publishTranscodeCompleted(event: ITranscodeCompletedEvent): Promise<void>;
   publishTranscodeFailed(event: ITranscodeFailedEvent): Promise<void>;
}

import { Observable } from 'rxjs';

export interface CategoryScoreItem {
   categoryId: string;
   score: number;
}

export interface IGetUserInterestsRequest {
   userId: string;
   limit?: number;
}

export interface IGetUserInterestsResponse {
   userId: string;
   topCategories: CategoryScoreItem[];
   seenVideoIds: string[];
}

export interface IWatchInterval {
   startMs: number;
   endMs: number;
}

export interface IRecordWatchSessionRequest {
   sessionId?: string;
   userId: string;
   videoId: string;
   watchDurationMs: number;
   videoDurationMs: number;
   isCompleted: boolean;
   loopCount: number;
   categoryIds: string[];
   tagIds: string[];
   intervals?: IWatchInterval[];
}

export interface IRecordWatchSessionResponse {
   success: boolean;
   message: string;
   calculatedScoreDelta: number;
}

export interface IAnalyzeGrpcService {
   getUserInterests(request: IGetUserInterestsRequest, metadata?: unknown): Observable<IGetUserInterestsResponse>;
   recordWatchSession(request: IRecordWatchSessionRequest, metadata?: unknown): Observable<IRecordWatchSessionResponse>;
}

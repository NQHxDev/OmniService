import { Injectable } from '@nestjs/common';
import { SCORING_RULES } from '@contracts/analyze';

export interface WatchInterval {
   startMs: number;
   endMs: number;
}

export interface WatchSessionScoreInput {
   watchDurationMs: number;
   videoDurationMs: number;
   isCompleted?: boolean;
   loopCount?: number;
   intervals?: Array<WatchInterval | [number, number]>;
}

export interface ScoreCalculationResult {
   completionRate: number;
   uniqueWatchedMs: number;
   durationCoefficient: number;
   scoreDelta: number;
}

/**
 * Merges overlapping or contiguous watch intervals into disjoint sorted intervals,
 * clamped within [0, maxDurationMs].
 */
export function mergeIntervals(
   intervals: Array<WatchInterval | [number, number]>,
   maxDurationMs?: number,
): Array<[number, number]> {
   if (!intervals || intervals.length === 0) return [];

   const normalized: Array<[number, number]> = intervals
      .map((item) => {
         let start = Array.isArray(item) ? item[0] : item.startMs;
         let end = Array.isArray(item) ? item[1] : item.endMs;
         if (start > end) {
            [start, end] = [end, start];
         }
         start = Math.max(0, start);
         if (maxDurationMs !== undefined && maxDurationMs > 0) {
            end = Math.min(maxDurationMs, end);
            start = Math.min(maxDurationMs, start);
         }
         return [start, end] as [number, number];
      })
      .filter(([start, end]) => end > start);

   if (normalized.length === 0) return [];

   normalized.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

   const merged: Array<[number, number]> = [normalized[0]];
   for (let i = 1; i < normalized.length; i++) {
      const current = normalized[i];
      const last = merged[merged.length - 1];

      if (current[0] <= last[1]) {
         last[1] = Math.max(last[1], current[1]);
      } else {
         merged.push(current);
      }
   }

   return merged;
}

/**
 * Calculates total unique milliseconds watched across all intervals.
 */
export function calculateUniqueCoverageMs(
   intervals: Array<WatchInterval | [number, number]>,
   maxDurationMs?: number,
): number {
   const merged = mergeIntervals(intervals, maxDurationMs);
   return merged.reduce((total, [start, end]) => total + (end - start), 0);
}

/**
 * Calculates a smooth time coefficient for video length.
 * Videos <= 60s -> coefficient = 1.0.
 * Longer videos receive higher engagement weights up to MAX_DURATION_COEFFICIENT.
 * Formula: 1 + 0.5 * log10(videoDurationMs / 60000)
 */
export function calculateDurationCoefficient(videoDurationMs: number): number {
   if (videoDurationMs <= 60000) return 1.0;
   const minutes = videoDurationMs / 60000;
   const rawCoeff = 1 + 0.5 * Math.log10(minutes);
   const clamped = Math.min(SCORING_RULES.MAX_DURATION_COEFFICIENT, Math.max(1.0, rawCoeff));
   return Number(clamped.toFixed(2));
}

@Injectable()
export class ScoringStrategy {
   /**
    * Calculates user behavioral affinity score based on:
    * 1. Unique content coverage via interval merging (prevents loop/seek cheating & speed bias).
    * 2. Retention thresholds (85% completion threshold for outro-friendliness).
    * 3. Smooth duration coefficient to reward deeper engagement with longer content.
    * 4. Capped replay/loop bonus to incentivize genuine interest while blocking bot farming.
    */
   calculateScore(input: WatchSessionScoreInput): ScoreCalculationResult {
      const { watchDurationMs, videoDurationMs, isCompleted = false, loopCount = 0, intervals } = input;

      const durationCoeff = calculateDurationCoefficient(videoDurationMs);

      // 1. Calculate unique watched duration
      let uniqueWatchedMs: number;
      if (intervals && intervals.length > 0) {
         uniqueWatchedMs = calculateUniqueCoverageMs(intervals, videoDurationMs);
      } else {
         uniqueWatchedMs = videoDurationMs > 0 ? Math.min(watchDurationMs, videoDurationMs) : 0;
      }

      // 2. Normalized completion rate [0.0, 1.0]
      const completionRate = videoDurationMs > 0 ? Math.min(1.0, uniqueWatchedMs / videoDurationMs) : 0;

      // 3. Rule: Rapid abandonment / Skip
      // User did NOT complete and either:
      // - Video is > 3s but watched < 3s, OR
      // - Completion rate is below skip threshold (< 15%)
      const isQuickAbandon =
         !isCompleted &&
         ((videoDurationMs > SCORING_RULES.SKIP_THRESHOLD_MS && watchDurationMs < SCORING_RULES.SKIP_THRESHOLD_MS) ||
            completionRate < SCORING_RULES.SKIP_COMPLETION_RATE);

      if (isQuickAbandon) {
         return {
            completionRate: Number(completionRate.toFixed(4)),
            uniqueWatchedMs,
            durationCoefficient: durationCoeff,
            scoreDelta: SCORING_RULES.SKIP_SCORE,
         };
      }

      // 4. Base engagement score
      let baseScore = 0;
      if (isCompleted || completionRate >= SCORING_RULES.COMPLETION_THRESHOLD) {
         baseScore = SCORING_RULES.HIGH_SCORE;
      } else if (completionRate >= SCORING_RULES.MILD_COMPLETION_RATE_MIN) {
         baseScore = SCORING_RULES.MILD_SCORE;
      }

      // 5. Apply duration coefficient
      let scoreDelta = baseScore * durationCoeff;

      // 6. Replay / Loop bonus (capped to prevent bot farming)
      const effectiveLoops = Math.min(Math.max(0, loopCount), SCORING_RULES.MAX_BONUS_LOOPS);
      if (effectiveLoops > 0) {
         scoreDelta += effectiveLoops * SCORING_RULES.LOOP_BONUS_PER_LOOP;
      }

      return {
         completionRate: Number(completionRate.toFixed(4)),
         uniqueWatchedMs,
         durationCoefficient: durationCoeff,
         scoreDelta: Math.round(scoreDelta * 100) / 100,
      };
   }
}

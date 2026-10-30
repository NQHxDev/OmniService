import {
   calculateDurationCoefficient,
   calculateUniqueCoverageMs,
   mergeIntervals,
   ScoringStrategy,
} from './scoring.strategy';
import { SCORING_RULES } from '@contracts/analyze';

describe('ScoringStrategy', () => {
   let strategy: ScoringStrategy;

   beforeEach(() => {
      strategy = new ScoringStrategy();
   });

   describe('mergeIntervals & calculateUniqueCoverageMs', () => {
      it('should return empty when no intervals provided', () => {
         expect(mergeIntervals([])).toEqual([]);
         expect(calculateUniqueCoverageMs([])).toBe(0);
      });

      it('should merge overlapping intervals and clamp within duration', () => {
         const intervals = [
            { startMs: 5000, endMs: 15000 },
            { startMs: 10000, endMs: 20000 },
            { startMs: 25000, endMs: 35000 },
         ];
         const merged = mergeIntervals(intervals, 30000);
         expect(merged).toEqual([
            [5000, 20000],
            [25000, 30000],
         ]);
         expect(calculateUniqueCoverageMs(intervals, 30000)).toBe(15000 + 5000);
      });

      it('should handle tuple arrays and unsorted or inverted intervals', () => {
         const intervals: Array<[number, number]> = [
            [20000, 10000], // inverted
            [0, 5000],
            [15000, 25000],
         ];
         const merged = mergeIntervals(intervals, 30000);
         expect(merged).toEqual([
            [0, 5000],
            [10000, 25000],
         ]);
         expect(calculateUniqueCoverageMs(intervals, 30000)).toBe(5000 + 15000);
      });
   });

   describe('calculateDurationCoefficient', () => {
      it('should return 1.0 for short videos (<= 60s)', () => {
         expect(calculateDurationCoefficient(30000)).toBe(1.0);
         expect(calculateDurationCoefficient(60000)).toBe(1.0);
      });

      it('should scale logarithmically for longer videos', () => {
         // 10 minutes = 600,000ms -> log10(10) = 1 -> 1 + 0.5 * 1 = 1.5
         expect(calculateDurationCoefficient(600000)).toBe(1.5);
      });

      it('should clamp duration coefficient at MAX_DURATION_COEFFICIENT', () => {
         // 1000 minutes
         expect(calculateDurationCoefficient(60000000)).toBe(SCORING_RULES.MAX_DURATION_COEFFICIENT);
      });
   });

   describe('calculateScore without intervals (backward compatibility)', () => {
      it('should give negative score if user skips video (< 3s on longer video)', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 1500,
            videoDurationMs: 30000,
            isCompleted: false,
            loopCount: 0,
         });

         expect(result.scoreDelta).toBe(SCORING_RULES.SKIP_SCORE);
         expect(result.completionRate).toBe(0.05);
      });

      it('should give negative score if user skips with < 15% completion rate', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 5000,
            videoDurationMs: 60000,
            isCompleted: false,
            loopCount: 0,
         });

         expect(result.scoreDelta).toBe(SCORING_RULES.SKIP_SCORE);
         expect(result.completionRate).toBeCloseTo(0.0833, 3);
      });

      it('should give positive score when a very short video (< 3s) is completed', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 2500,
            videoDurationMs: 2500,
            isCompleted: true,
            loopCount: 0,
         });

         expect(result.scoreDelta).toBe(SCORING_RULES.HIGH_SCORE);
         expect(result.completionRate).toBe(1.0);
      });

      it('should give negative score when a very short video is immediately skipped without completion', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 200,
            videoDurationMs: 2500,
            isCompleted: false,
            loopCount: 0,
         });

         expect(result.scoreDelta).toBe(SCORING_RULES.SKIP_SCORE);
         expect(result.completionRate).toBe(0.08);
      });

      it('should give mild score for normal retention (30% - 70%)', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 15000,
            videoDurationMs: 30000,
            isCompleted: false,
            loopCount: 0,
         });

         expect(result.scoreDelta).toBe(SCORING_RULES.MILD_SCORE);
         expect(result.completionRate).toBe(0.5);
      });

      it('should give high score for high retention (> 80%)', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 27000,
            videoDurationMs: 30000,
            isCompleted: false,
            loopCount: 0,
         });

         expect(result.scoreDelta).toBe(SCORING_RULES.HIGH_SCORE);
         expect(result.completionRate).toBe(0.9);
      });

      it('should add loop bonus for repeated views', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 60000,
            videoDurationMs: 30000,
            isCompleted: true,
            loopCount: 2,
         });

         // HIGH_SCORE (3) + 2 * LOOP_BONUS (2 * 2 = 4) = 7
         expect(result.scoreDelta).toBe(7);
      });

      it('should cap loop bonus to prevent bot gaming', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 60000,
            videoDurationMs: 30000,
            isCompleted: true,
            loopCount: 50,
         });

         // HIGH_SCORE (3) + MAX_BONUS_LOOPS (3) * 2 = 9
         expect(result.scoreDelta).toBe(9);
      });
   });

   describe('calculateScore with intervals (unique content coverage)', () => {
      it('should grant full score when user watches at 2.0x speed across whole video', () => {
         // User watched 15s in wall time on a 30s video, but covered [0, 30000]
         const result = strategy.calculateScore({
            watchDurationMs: 15000,
            videoDurationMs: 30000,
            isCompleted: false,
            intervals: [{ startMs: 0, endMs: 30000 }],
         });

         expect(result.completionRate).toBe(1.0);
         expect(result.scoreDelta).toBe(SCORING_RULES.HIGH_SCORE);
      });

      it('should penalize user who loops only a small 5s snippet 10 times', () => {
         // Wall time is 50,000ms on a 60s video, but user only looped [0, 5000]
         const result = strategy.calculateScore({
            watchDurationMs: 50000,
            videoDurationMs: 60000,
            isCompleted: false,
            intervals: [
               { startMs: 0, endMs: 5000 },
               { startMs: 0, endMs: 5000 },
               { startMs: 0, endMs: 5000 },
            ],
         });

         // Unique watched is 5000 / 60000 = 8.33% < 15% -> quick abandon
         expect(result.completionRate).toBeCloseTo(0.0833, 3);
         expect(result.scoreDelta).toBe(SCORING_RULES.SKIP_SCORE);
      });

      it('should reward outro-friendly completion when user reaches 85% threshold', () => {
         const result = strategy.calculateScore({
            watchDurationMs: 26000,
            videoDurationMs: 30000,
            intervals: [{ startMs: 0, endMs: 26000 }], // 86.67%
         });

         expect(result.completionRate).toBeCloseTo(0.8667, 3);
         expect(result.scoreDelta).toBe(SCORING_RULES.HIGH_SCORE);
      });

      it('should scale score with duration coefficient for deep engagement on long videos', () => {
         // 10-minute tutorial fully watched (600,000ms)
         const result = strategy.calculateScore({
            watchDurationMs: 600000,
            videoDurationMs: 600000,
            isCompleted: true,
         });

         // Duration coeff = 1.5, base score = 3 -> 3 * 1.5 = 4.5
         expect(result.durationCoefficient).toBe(1.5);
         expect(result.scoreDelta).toBe(4.5);
      });
   });
});

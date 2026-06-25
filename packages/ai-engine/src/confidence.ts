export interface ConfidenceCalibration {
  bucket: string;
  predictedConfidence: number;
  actualAcceptanceRate: number;
  sampleCount: number;
  calibrationError: number;
}

export class ConfidenceCalibrator {
  private history: Array<{ predicted: number; accepted: boolean }> = [];

  record(predicted: number, accepted: boolean): void {
    this.history.push({ predicted, accepted });
  }

  calibrate(rawConfidence: number): number {
    if (this.history.length < 30) return rawConfidence;
    const bucket = Math.floor(rawConfidence * 10) / 10;
    const bucketEntries = this.history.filter(h => Math.floor(h.predicted * 10) / 10 === bucket);
    if (bucketEntries.length === 0) return rawConfidence;
    const actualRate = bucketEntries.filter(e => e.accepted).length / bucketEntries.length;
    return 0.5 * rawConfidence + 0.5 * actualRate;
  }

  getCalibrationReport(): ConfidenceCalibration[] {
    const buckets: Array<ConfidenceCalibration> = [];
    for (let b = 0; b < 10; b++) {
      const bucket = b / 10;
      const entries = this.history.filter(h => Math.floor(h.predicted * 10) / 10 === bucket);
      if (entries.length === 0) continue;
      const predicted = entries.reduce((s, e) => s + e.predicted, 0) / entries.length;
      const actual = entries.filter(e => e.accepted).length / entries.length;
      buckets.push({
        bucket: `${bucket.toFixed(1)}-${(bucket + 0.1).toFixed(1)}`,
        predictedConfidence: predicted,
        actualAcceptanceRate: actual,
        sampleCount: entries.length,
        calibrationError: Math.abs(predicted - actual),
      });
    }
    return buckets;
  }
}
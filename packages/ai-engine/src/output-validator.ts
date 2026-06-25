import { z, ZodSchema, ZodError } from 'zod';

export interface RepairResult<T> {
  data: T | null;
  raw: string;
  repaired: boolean;
  repairAttempts: number;
  errors: string[];
}

export class StructuredOutputValidator {
  repair<T>(rawContent: string, schema: ZodSchema<T>, repairPrompt?: string): RepairResult<T> {
    const errors: string[] = [];
    let repaired = false;
    let repairAttempts = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      errors.push(`JSON parse error: ${(parseErr as Error).message}`);
      const extracted = this.extractJSON(rawContent);
      if (extracted) {
        repairAttempts++;
        try {
          parsed = JSON.parse(extracted);
          repaired = true;
          errors.push('Repaired: extracted JSON from markdown code block');
        } catch {
          const fixed = this.repairJSON(extracted);
          try {
            parsed = JSON.parse(fixed);
            repaired = true;
            repairAttempts++;
            errors.push('Repaired: fixed JSON syntax');
          } catch (fixErr) {
            errors.push(`Repair failed: ${(fixErr as Error).message}`);
            return { data: null, raw: rawContent, repaired: false, repairAttempts, errors };
          }
        }
      } else {
        return { data: null, raw: rawContent, repaired: false, repairAttempts, errors };
      }
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return { data: result.data, raw: rawContent, repaired, repairAttempts, errors };
    }

    errors.push(`Schema validation error: ${result.error.message}`);
    const coerced = this.coerceDefaults(parsed, result.error);
    if (coerced) {
      const retry = schema.safeParse(coerced);
      if (retry.success) {
        repairAttempts++;
        return { data: retry.data, raw: rawContent, repaired: true, repairAttempts, errors: [...errors, 'Repaired: applied defaults for missing/invalid fields'] };
      }
    }

    return { data: null, raw: rawContent, repaired: false, repairAttempts, errors };
  }

  private extractJSON(text: string): string | null {
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/,
      /```\s*([\s\S]*?)\s*```/,
      /\{[\s\S]*\}/,
      /\[[\s\S]*\]/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    return null;
  }

  private repairJSON(text: string): string {
    let fixed = text.trim();
    fixed = fixed.replace(/,\s*}/g, '}');
    fixed = fixed.replace(/,\s*]/g, ']');
    fixed = fixed.replace(/([{,]\s*)(\w+):/g, '$1"$2":');
    fixed = fixed.replace(/'/g, '"');
    fixed = fixed.replace(/[\u0000-\u001F]/g, '');
    if (!fixed.startsWith('{') && !fixed.startsWith('[')) {
      const braceIdx = fixed.indexOf('{');
      if (braceIdx > 0) fixed = fixed.substring(braceIdx);
    }
    return fixed;
  }

  private coerceDefaults(data: unknown, error: ZodError): unknown {
    if (typeof data !== 'object' || data === null) return null;
    const obj = data as Record<string, unknown>;
    const cloned = JSON.parse(JSON.stringify(obj));
    for (const issue of error.issues) {
      const path = issue.path;
      if (path.length === 0) continue;
      let target: Record<string, unknown> = cloned;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i] as string;
        if (typeof target[key] !== 'object' || target[key] === null) {
          target[key] = {};
        }
        target = target[key] as Record<string, unknown>;
      }
      const lastKey = path[path.length - 1] as string;
      if (issue.code === 'invalid_type') {
        const expected = (issue as { expected: string }).expected;
        if (expected === 'array') target[lastKey] = [];
        else if (expected === 'object') target[lastKey] = {};
        else if (expected === 'string') target[lastKey] = String(target[lastKey] || '');
        else if (expected === 'number') target[lastKey] = Number(target[lastKey]) || 0;
        else if (expected === 'boolean') target[lastKey] = Boolean(target[lastKey]);
      } else if (issue.code === 'too_small') {
        if (Array.isArray(target[lastKey])) {
          target[lastKey] = [...(target[lastKey] as unknown[]), this.defaultForIssue(issue)];
        }
      }
    }
    return cloned;
  }

  private defaultForIssue(issue: z.ZodIssue): unknown {
    if (issue.code === 'too_small') {
      const path = issue.path.join('.');
      if (path.includes('evidence')) {
        return { type: 'metadata', sourceRef: 'unknown', description: 'Auto-repaired: evidence was missing', weight: 0.5 };
      }
      if (path.includes('mappings')) {
        return { sourceObjectId: 'unknown', targetObjectId: 'unknown', confidence: 0.5, evidence: [{ type: 'metadata', sourceRef: 'unknown', description: 'Auto-repaired', weight: 0.5 }], reasoning: 'Auto-repaired mapping' };
      }
    }
    return null;
  }
}

export const outputValidator = new StructuredOutputValidator();
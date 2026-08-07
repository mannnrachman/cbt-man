import Redis from "ioredis";
import type { SesiUjian } from "@/lib/cbt/types";

// Key patterns for Redis
const REDIS_KEYS = {
  sessionAnswers: (sesiId: string) => `cbt:session:${sesiId}:answers`,
  sessionTimer: (sesiId: string) => `cbt:session:${sesiId}:timer`,
  sessionLogs: (sesiId: string) => `cbt:session:${sesiId}:logs`,
  onlineUser: (userId: string) => `cbt:online:${userId}`,
};

class RedisService {
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  // Fallback in-memory cache when Redis server is unreachable
  private memoryFallback: Map<string, { data: unknown, expiresAt: number | null }> = new Map();

  private setFallback(key: string, data: unknown, ttlSeconds?: number) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryFallback.set(key, { data, expiresAt });
  }

  private getFallback(key: string): unknown | null {
    const entry = this.memoryFallback.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryFallback.delete(key);
      return null;
    }
    return entry.data;
  }

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          if (times > 5) return null; // stop retrying after 5 attempts to avoid blocking
          return Math.min(times * 100, 3000);
        },
      });

      this.redis.on("connect", () => {
        this.isConnected = true;
        console.log("[Redis] Connected successfully to Redis server.");
      });

      this.redis.on("error", (err) => {
        if (this.isConnected) {
          console.warn("[Redis] Disconnected or Connection Error:", err.message);
        }
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
    }
  }

  public get status() {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? "Redis Server (RAM)" : "Fallback In-Memory Buffer",
    };
  }

  /**
   * 1. Save temporary answer to Redis RAM (< 2ms response)
   */
  async saveTempAnswer(
    sesiId: string,
    soalId: string,
    jawabanData: { jawabanIds: string[]; jawabanEssay: string; ragu: boolean },
    ttlSeconds: number = 259200 // Default 3 days (72 hours) buffer for long/1-day exams
  ): Promise<boolean> {
    const key = REDIS_KEYS.sessionAnswers(sesiId);
    const payload = JSON.stringify({
      ...jawabanData,
      updatedAt: Date.now(),
    });

    // Also log audit trail
    await this.logAudit(sesiId, "ANSWER_UPDATED", { soalId, ...jawabanData });

    if (this.isConnected && this.redis) {
      try {
        await this.redis.hset(key, soalId, payload);
        await this.redis.expire(key, ttlSeconds);
        return true;
      } catch (err) {
        console.warn("[Redis] Failed to write HSET, using fallback memory:", err);
      }
    }

    // Fallback in-memory map
    let map = this.getFallback(key) as Map<string, string> | null;
    if (!map) {
      map = new Map();
    }
    map.set(soalId, payload);
    this.setFallback(key, map, ttlSeconds);
    return true;
  }

  /**
   * 2. Retrieve all temporary answers for session recovery (after power loss/restart)
   */
  async getTempAnswers(sesiId: string): Promise<Record<string, { jawabanIds: string[]; jawabanEssay: string; ragu: boolean; updatedAt: number }>> {
    const key = REDIS_KEYS.sessionAnswers(sesiId);

    if (this.isConnected && this.redis) {
      try {
        const rawAnswers = await this.redis.hgetall(key);
        const parsed: Record<string, { jawabanIds: string[]; jawabanEssay: string; ragu: boolean; updatedAt: number }> = {};
        for (const [soalId, jsonStr] of Object.entries(rawAnswers)) {
          try {
            parsed[soalId] = JSON.parse(jsonStr);
          } catch {
            // ignore malformed
          }
        }
        return parsed;
      } catch (err) {
        console.warn("[Redis] Failed to fetch HGETALL:", err);
      }
    }

    // Fallback in-memory map
    const map = this.getFallback(key) as Map<string, string> | null;
    if (!map) return {};
    const parsed: Record<string, { jawabanIds: string[]; jawabanEssay: string; ragu: boolean; updatedAt: number }> = {};
    for (const [soalId, jsonStr] of map.entries()) {
      try {
        parsed[soalId] = JSON.parse(jsonStr);
      } catch {
        // ignore malformed
      }
    }
    return parsed;
  }

  /**
   * 3. Server-Authoritative Timer (Locks remaining time & prevents client-side tampering)
   */
  async setSessionTimer(sesiId: string, endsAt: number, durationMinutes: number): Promise<void> {
    const key = REDIS_KEYS.sessionTimer(sesiId);
    const data = JSON.stringify({ endsAt, durationMinutes, startedAt: Date.now() });

    if (this.isConnected && this.redis) {
      try {
        await this.redis.set(key, data, "EX", durationMinutes * 60 + 3600);
        return;
      } catch {
        // fallback
      }
    }
    this.setFallback(key, data, durationMinutes * 60 + 3600);
  }

  async getSessionTimer(sesiId: string): Promise<{ endsAt: number; durationMinutes: number; startedAt: number } | null> {
    const key = REDIS_KEYS.sessionTimer(sesiId);

    if (this.isConnected && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) return JSON.parse(data);
      } catch {
        // fallback
      }
    }

    const data = this.getFallback(key) as string | null;
    return data ? JSON.parse(data) : null;
  }

  /**
   * 4. Log Audit Trail for Session Activity (Sudden disconnection / power loss recovery tracking)
   */
  async logAudit(sesiId: string, action: string, details?: Record<string, unknown>): Promise<void> {
    const key = REDIS_KEYS.sessionLogs(sesiId);
    const entry = JSON.stringify({
      timestamp: Date.now(),
      action,
      details,
    });

    if (this.isConnected && this.redis) {
      try {
        await this.redis.rpush(key, entry);
        await this.redis.expire(key, 86400 * 7); // keep 7 days for audit
        return;
      } catch {
        // fallback
      }
    }

    let logs = this.getFallback(key) as string[] | null;
    if (!logs) {
      logs = [];
    }
    logs.push(entry);
    this.setFallback(key, logs, 86400 * 7);
  }

  async getAuditLogs(sesiId: string): Promise<Array<{ timestamp: number; action: string; details?: Record<string, unknown> }>> {
    const key = REDIS_KEYS.sessionLogs(sesiId);

    if (this.isConnected && this.redis) {
      try {
        const logs = await this.redis.lrange(key, 0, -1);
        return logs.map((l) => JSON.parse(l));
      } catch {
        // fallback
      }
    }

    const logs = (this.getFallback(key) as string[]) || [];
    return logs.map((l: string) => JSON.parse(l));
  }

  /**
   * 5. Clear session buffer upon final submission to SQLite
   */
  async clearSessionBuffer(sesiId: string): Promise<void> {
    const ansKey = REDIS_KEYS.sessionAnswers(sesiId);
    const timerKey = REDIS_KEYS.sessionTimer(sesiId);

    if (this.isConnected && this.redis) {
      try {
        await this.redis.del(ansKey, timerKey);
      } catch {
        // fallback
      }
    }
    this.memoryFallback.delete(ansKey);
    this.memoryFallback.delete(timerKey);
  }
}

export const redisService = new RedisService();

import { createServerFn } from "@tanstack/react-start";
import { redisService } from "./service";

export const getTempAnswersServer = createServerFn({ method: "POST" })
  .validator((sesiId: string) => sesiId)
  .handler(async ({ data: sesiId }) => {
    return redisService.getTempAnswers(sesiId);
  });

export const setSessionTimerServer = createServerFn({ method: "POST" })
  .validator((data: { sesiId: string; endsAt: number; durationMinutes: number }) => data)
  .handler(async ({ data }) => {
    return redisService.setSessionTimer(data.sesiId, data.endsAt, data.durationMinutes);
  });

export const saveTempAnswerServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sesiId: string;
      soalId: string;
      jawabanData: { jawabanIds: string[]; jawabanEssay: string; ragu: boolean };
    }) => data
  )
  .handler(async ({ data }) => {
    return redisService.saveTempAnswer(data.sesiId, data.soalId, data.jawabanData);
  });

export const clearSessionBufferServer = createServerFn({ method: "POST" })
  .validator((sesiId: string) => sesiId)
  .handler(async ({ data: sesiId }) => {
    return redisService.clearSessionBuffer(sesiId);
  });

export const logAuditServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sesiId: string;
      action: string;
      details?: Record<string, unknown>;
    }) => data
  )
  .handler(async ({ data }) => {
    return redisService.logAudit(data.sesiId, data.action, data.details);
  });

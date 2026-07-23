import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireCaller } from "../db/auth";

export const getAuditLogsServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			page: z.number().int().min(1).default(1),
			pageSize: z.number().int().min(1).max(100).default(50),
			userId: z.string().optional(),
			entity: z.string().optional(),
			action: z.string().optional(),
			dateFrom: z.number().optional(),
			dateTo: z.number().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const caller = await requireCaller();
		if (!caller || caller.role !== "super_admin") {
			return { ok: false as const, error: "Forbidden", logs: [], total: 0 };
		}
		const where: Record<string, unknown> = {};
		if (data.userId) where.userId = data.userId;
		if (data.entity) where.entity = data.entity;
		if (data.action) where.action = data.action;
		if (data.dateFrom || data.dateTo) {
			where.createdAt = {};
			if (data.dateFrom)
				(where.createdAt as Record<string, Date>).gte = new Date(data.dateFrom);
			if (data.dateTo)
				(where.createdAt as Record<string, Date>).lte = new Date(data.dateTo);
		}
		const [logs, total] = await Promise.all([
			prisma.auditLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (data.page - 1) * data.pageSize,
				take: data.pageSize,
				select: {
					id: true,
					userId: true,
					userRole: true,
					action: true,
					entity: true,
					entityId: true,
					details: true,
					createdAt: true,
				},
			}),
			prisma.auditLog.count({ where }),
		]);
		return { ok: true as const, logs, total };
	});

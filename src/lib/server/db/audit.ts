// Audit log server-side functions.
// Logs are immutable (no delete/update via API) per PRD v2.

import { prisma } from "./prisma";

export interface AuditLogEntry {
	userId: string;
	userRole: string;
	action: string;
	entity: string;
	entityId?: string;
	details?: string;
}

/** Write an audit log entry. Fire-and-forget: never throws to caller. */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
	try {
		await prisma.auditLog.create({
			data: {
				id: `al_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
				userId: entry.userId,
				userRole: entry.userRole,
				action: entry.action,
				entity: entry.entity,
				entityId: entry.entityId ?? null,
				details: entry.details?.replace(/"password(Hash)?":"[^"]*"/g, '"password$1":"[REDACTED]"') ?? null,
			},
		});
	} catch {
		// Swallow errors — audit logging must never break the primary operation
		console.error("Failed to write audit log:", entry);
	}
}

/** Get audit logs with filtering. Admin only. */
export async function getAuditLogs(filters: {
	userId?: string;
	entity?: string;
	action?: string;
	from?: Date;
	to?: Date;
	limit?: number;
	offset?: number;
}): Promise<{ logs: unknown[]; total: number }> {
	const where: Record<string, unknown> = {};
	if (filters.userId) where.userId = filters.userId;
	if (filters.entity) where.entity = filters.entity;
	if (filters.action) where.action = filters.action;
	if (filters.from || filters.to) {
		where.createdAt = {};
		if (filters.from)
			(where.createdAt as Record<string, Date>).gte = filters.from;
		if (filters.to) (where.createdAt as Record<string, Date>).lte = filters.to;
	}

	const [logs, total] = await Promise.all([
		prisma.auditLog.findMany({
			where,
			orderBy: { createdAt: "desc" },
			take: filters.limit ?? 100,
			skip: filters.offset ?? 0,
		}),
		prisma.auditLog.count({ where }),
	]);

	return { logs, total };
}

import { eq, desc, and, ilike, sql, count } from "drizzle-orm";

export async function getEmailLogsImpl(
        anyDb: any,
        tables: { email_logs: any; users: any; bookings: any },
        query: {
                page?: string | number;
                limit?: string | number;
                status?: string;
                email_type?: string;
                search?: string;
        }
) {
        try {
                const page = Number(query.page) || 1;
                const limit = Number(query.limit) || 20;
                const offset = (page - 1) * limit;

                const whereConditions = [];

                if (query.status && query.status !== "all") {
                        whereConditions.push(eq(tables.email_logs.status, query.status));
                }

                if (query.email_type && query.email_type !== "all") {
                        whereConditions.push(eq(tables.email_logs.email_type, query.email_type));
                }

                if (query.search) {
                        whereConditions.push(ilike(tables.email_logs.recipient, `%${query.search}%`));
                }

                const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

                // Get total count
                const [totalRes] = await anyDb
                        .select({ count: count() })
                        .from(tables.email_logs)
                        .where(whereClause);

                // Get logs joined with user or booking names if available
                const logs = await anyDb
                        .select({
                                id: tables.email_logs.id,
                                recipient: tables.email_logs.recipient,
                                subject: tables.email_logs.subject,
                                email_type: tables.email_logs.email_type,
                                status: tables.email_logs.status,
                                provider: tables.email_logs.provider,
                                error_message: tables.email_logs.error_message,
                                user_id: tables.email_logs.user_id,
                                booking_id: tables.email_logs.booking_id,
                                metadata: tables.email_logs.metadata,
                                sent_at: tables.email_logs.sent_at,
                                created_at: tables.email_logs.created_at,
                                updated_at: tables.email_logs.updated_at,
                        })
                        .from(tables.email_logs)
                        .where(whereClause)
                        .orderBy(desc(tables.email_logs.created_at))
                        .limit(limit)
                        .offset(offset);

                return {
                        status: 200,
                        data: logs,
                        pagination: {
                                total: Number(totalRes?.count || 0),
                                page,
                                limit,
                                totalPages: Math.ceil(Number(totalRes?.count || 0) / limit),
                        },
                };
        } catch (err: any) {
                console.error("[getEmailLogsImpl] Error:", err);
                return { status: 500, message: err?.message || "Internal error" };
        }
}

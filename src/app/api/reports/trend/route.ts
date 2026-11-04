import "server-only";
import { NextResponse } from "next/server";
import { authenticateUser, requireRoles, handleApiError } from "@/lib/auth/server";
import { query } from "@/lib/db/client";

type Period = "day" | "week" | "month";
const PERIOD_CONFIG: Record<Period, { step: string; count: number }> = {
  day: { step: "1 day", count: 14 },
  week: { step: "1 week", count: 12 },
  month: { step: "1 month", count: 12 },
};

export async function GET(request: Request) {
  try {
    const user = await authenticateUser(request);
    requireRoles(user, ["admin", "staff", "viewer"]);

    const url = new URL(request.url);
    const rawPeriod = url.searchParams.get("period") || "day";
    if (!["day", "week", "month"].includes(rawPeriod)) {
      return NextResponse.json({ message: "Kỳ báo cáo không hợp lệ" }, { status: 400 });
    }
    const period = rawPeriod as Period;
    const { step, count } = PERIOD_CONFIG[period];

    const result = await query(
      `with periods as (
        select generate_series(
          date_trunc($1::text, now() at time zone 'Asia/Ho_Chi_Minh') - ($2::int - 1) * $3::interval,
          date_trunc($1::text, now() at time zone 'Asia/Ho_Chi_Minh'),
          $3::interval
        ) as bucket
      ), movements as (
        select date_trunc($1::text, created_at at time zone 'Asia/Ho_Chi_Minh') as bucket,
          type, sum(quantity)::bigint as amount
        from public.stock_movements
        where created_at >= ((select min(bucket) from periods) at time zone 'Asia/Ho_Chi_Minh')
        group by 1, 2
      )
      select to_char(p.bucket, 'YYYY-MM-DD') as period,
        coalesce(sum(m.amount) filter(where m.type = 'IN'), 0)::bigint as inbound,
        coalesce(sum(m.amount) filter(where m.type = 'OUT'), 0)::bigint as outbound
      from periods p left join movements m on p.bucket = m.bucket
      group by p.bucket order by p.bucket`,
      [period, count, step]
    );

    return NextResponse.json({
      period,
      timezone: "Asia/Ho_Chi_Minh",
      points: result.rows,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

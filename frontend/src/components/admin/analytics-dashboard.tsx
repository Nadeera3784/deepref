"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes, formatNumber } from "@/lib/format";
import { queries } from "@/lib/queries";
import type { Analytics } from "@/types";

const chartConfig = {
  questions: { label: "Questions", color: "var(--chart-1)" },
} satisfies ChartConfig;

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const parseDay = (day: string) => new Date(`${day}T00:00:00`);

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-muted-foreground px-4 text-xs">{hint}</CardContent>}
    </Card>
  );
}

function ServiceStatus() {
  const { data } = useQuery(queries.serviceHealth());
  const services = [
    { key: "database", label: "Database" },
    { key: "storage", label: "Storage (RustFS)" },
    { key: "llm", label: "LLM (SmolLM2)" },
    { key: "embeddings", label: "Embeddings" },
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {services.map(({ key, label }) => {
        const up = data?.[key];
        return (
          <Badge key={key} variant="outline" className="gap-1.5">
            {data === undefined ? (
              <span className="bg-muted-foreground size-2 rounded-full" />
            ) : up ? (
              <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="text-destructive" />
            )}
            {label}
            <span className="text-muted-foreground">
              {data === undefined ? "…" : up ? "up" : "down"}
            </span>
          </Badge>
        );
      })}
    </div>
  );
}

function sum(daily: Analytics["daily"], key: "questions" | "new_users" | "documents") {
  return daily.reduce((total, d) => total + d[key], 0);
}

function dateRange(daily: Analytics["daily"]): string | null {
  const first = daily.at(0);
  const last = daily.at(-1);
  if (!first || !last) return null;
  return `${shortDate.format(parseDay(first.day))} – ${shortDate.format(parseDay(last.day))}`;
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const { data, isPending, error } = useQuery(queries.analytics(days));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ServiceStatus />
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40" aria-label="Time range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-destructive text-sm">{error.message}</p>}
      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Users"
              value={formatNumber(data.totals.users)}
              hint={`${formatNumber(data.totals.active_users)} active · +${sum(data.daily, "new_users")} in range`}
            />
            <StatTile
              label="Documents"
              value={formatNumber(data.totals.documents)}
              hint={`${formatBytes(data.totals.storage_bytes)} · ${formatNumber(data.totals.chunks)} chunks`}
            />
            <StatTile
              label="Questions asked"
              value={formatNumber(data.totals.questions)}
              hint={`${formatNumber(sum(data.daily, "questions"))} in range · ${formatNumber(data.totals.conversations)} chats`}
            />
            <StatTile
              label="Avg. answer time"
              value={
                data.totals.avg_latency_ms === null
                  ? "—"
                  : `${(data.totals.avg_latency_ms / 1000).toFixed(1)} s`
              }
              hint={`${formatNumber(data.totals.total_tokens)} tokens generated`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Questions per day</CardTitle>
              <CardDescription>
                {dateRange(data.daily) ?? "No activity in this period"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={data.daily} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={(day: string) => shortDate.format(parseDay(day))}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)" }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(day) => shortDate.format(parseDay(String(day)))}
                      />
                    }
                  />
                  <Bar
                    dataKey="questions"
                    fill="var(--color-questions)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Most active users</CardTitle>
                <CardDescription>All time, by questions asked</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Questions</TableHead>
                      <TableHead className="text-right">Documents</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_users.map((user) => (
                      <TableRow key={user.email}>
                        <TableCell className="max-w-0 w-full">
                          <div className="truncate font-medium">{user.full_name || user.email}</div>
                          {user.full_name && (
                            <div className="text-muted-foreground truncate text-xs">{user.email}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{user.questions}</TableCell>
                        <TableCell className="text-right tabular-nums">{user.documents}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Document status</CardTitle>
                <CardDescription>Across all users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(["ready", "processing", "failed"] as const).map((status) => {
                  const count =
                    data.documents_by_status.find((s) => s.status === status)?.count ?? 0;
                  return (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{status}</span>
                      <span className="font-medium tabular-nums">{formatNumber(count)}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

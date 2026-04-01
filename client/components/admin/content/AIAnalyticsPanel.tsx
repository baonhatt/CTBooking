import React, { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { buildUrl } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UiConfig {
  title?: string;
  chart_type?: "bar" | "line" | "pie";
  x_axis_key?: string;
  y_axis_key?: string;
  y_axis_label?: string;
  color?: string;
}

interface AnalyticsResult {
  display_type: "table" | "dynamic_chart" | "summary";
  analysis_summary: string;
  ui_config: UiConfig;
  processed_data: Record<string, any>[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PIE_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#34d399", "#f87171", "#a78bfa", "#fb923c", "#38bdf8"];

function formatVnd(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

const VndTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ai-tooltip">
      <p className="ai-tooltip-label">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? "#fff" }}>
          {p.name}: {typeof p.value === "number" && p.value > 10000 ? p.value.toLocaleString("vi-VN") + "đ" : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Sub-renderers ────────────────────────────────────────────────────────────
function TableRenderer({ data, config }: { data: Record<string, any>[]; config: UiConfig }) {
  if (!data.length) return <p className="ai-empty">Không có dữ liệu.</p>;
  const headers = Object.keys(data[0]);
  return (
    <div className="ai-table-wrap">
      <table className="ai-table">
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {headers.map(h => (
                <td key={h}>
                  {typeof row[h] === "number" && row[h] > 10000
                    ? row[h].toLocaleString("vi-VN") + "đ"
                    : String(row[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartRenderer({ data, config }: { data: Record<string, any>[]; config: UiConfig }) {
  if (!data.length) return <p className="ai-empty">Không có dữ liệu biểu đồ.</p>;
  const chartType = config.chart_type ?? "bar";
  const xKey = config.x_axis_key ?? Object.keys(data[0])[0];
  const yKey = config.y_axis_key ?? Object.keys(data[0])[1];
  const color = config.color ?? "#6366f1";

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={120} label={(e) => `${e[xKey]} (${e[yKey]})`}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => typeof v === "number" && v > 10000 ? v.toLocaleString("vi-VN") + "đ" : v} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey={xKey} tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tickFormatter={formatVnd} tick={{ fill: "#94a3b8", fontSize: 12 }} label={{ value: config.y_axis_label ?? "", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
          <Tooltip content={<VndTooltip />} />
          <Legend />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // default: bar
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} tick={{ fill: "#94a3b8", fontSize: 12 }} />
        <YAxis tickFormatter={formatVnd} tick={{ fill: "#94a3b8", fontSize: 12 }} label={{ value: config.y_axis_label ?? "", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
        <Tooltip content={<VndTooltip />} />
        <Legend />
        <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Suggested Questions ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Phim nào bán vé chạy nhất?",
  "Doanh thu theo từng phương thức thanh toán",
  "Khung giờ nào khách đặt vé nhiều nhất?",
  "Doanh thu từng tháng trong năm nay",
  "Gói vé nào được mua nhiều nhất?",
  "Tóm tắt tổng quan kinh doanh",
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIAnalyticsPanel() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (question?: string) => {
    const msg = (question ?? input).trim();
    if (!msg) return;
    if (question) setInput(question);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(buildUrl("/api/ai-analytics"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: msg }),
      });
      const data = await res.json() as any;
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data.result as AnalyticsResult);
    } catch (e: any) {
      setError(e?.message ?? "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) handleAnalyze();
  };

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-panel-header">
        <span className="ai-panel-icon">🤖</span>
        <div>
          <h2 className="ai-panel-title">AI Analytics</h2>
          <p className="ai-panel-subtitle">Phân tích dữ liệu kinh doanh bằng trí tuệ nhân tạo</p>
        </div>
      </div>

      {/* Input row */}
      <div className="ai-input-row">
        <input
          className="ai-input"
          type="text"
          placeholder="Ví dụ: Phim nào bán chạy nhất? Doanh thu tháng này?"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="ai-btn"
          onClick={() => handleAnalyze()}
          disabled={loading || !input.trim()}
        >
          {loading ? <span className="ai-spinner" /> : "Phân tích"}
        </button>
      </div>

      {/* Suggested questions */}
      <div className="ai-suggestions">
        {SUGGESTIONS.map(s => (
          <button key={s} className="ai-chip" onClick={() => handleAnalyze(s)} disabled={loading}>
            {s}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="ai-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="ai-loading">
          <div className="ai-shimmer ai-shimmer-lg" />
          <div className="ai-shimmer ai-shimmer-sm" />
          <div className="ai-shimmer ai-shimmer-md" />
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="ai-result">
          {/* Analysis summary always on top */}
          {result.analysis_summary && (
            <div className="ai-summary-box">
              <span className="ai-summary-icon">💡</span>
              <p className="ai-summary-text">{result.analysis_summary}</p>
            </div>
          )}

          {/* Chart / Table / Summary */}
          {result.display_type !== "summary" && result.processed_data?.length > 0 && (
            <div className="ai-viz-card">
              {result.ui_config?.title && (
                <h3 className="ai-viz-title">{result.ui_config.title}</h3>
              )}
              {result.display_type === "dynamic_chart"
                ? <ChartRenderer data={result.processed_data} config={result.ui_config} />
                : <TableRenderer data={result.processed_data} config={result.ui_config} />}
            </div>
          )}
        </div>
      )}

      <style>{`
        .ai-panel {
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 16px;
          padding: 24px;
          color: #e2e8f0;
          font-family: 'Inter', system-ui, sans-serif;
          margin-bottom: 24px;
        }
        .ai-panel-header {
          display: flex; align-items: center; gap: 14px; margin-bottom: 20px;
        }
        .ai-panel-icon { font-size: 32px; }
        .ai-panel-title { font-size: 1.25rem; font-weight: 700; color: #c7d2fe; margin: 0; }
        .ai-panel-subtitle { font-size: 0.8rem; color: #64748b; margin: 0; margin-top: 2px; }

        .ai-input-row {
          display: flex; gap: 10px; margin-bottom: 12px;
        }
        .ai-input {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 10px;
          padding: 11px 16px;
          color: #e2e8f0;
          font-size: 0.92rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .ai-input:focus { border-color: #6366f1; }
        .ai-input::placeholder { color: #475569; }
        .ai-btn {
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 0 22px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          min-width: 100px;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.2s, transform 0.1s;
        }
        .ai-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .ai-btn:disabled { opacity:0.45; cursor: not-allowed; }

        .ai-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ai-suggestions {
          display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 18px;
        }
        .ai-chip {
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.25);
          color: #a5b4fc;
          border-radius: 20px;
          padding: 5px 13px;
          font-size: 0.78rem;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .ai-chip:hover:not(:disabled) { background: rgba(99,102,241,0.28); color: #c7d2fe; }
        .ai-chip:disabled { opacity: 0.4; cursor: not-allowed; }

        .ai-error {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px;
          padding: 12px 16px;
          color: #fca5a5;
          font-size: 0.88rem;
          margin-bottom: 12px;
        }

        .ai-loading { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
        .ai-shimmer {
          border-radius: 8px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        .ai-shimmer-lg  { height: 60px; }
        .ai-shimmer-md  { height: 260px; }
        .ai-shimmer-sm  { height: 30px; width: 60%; }
        @keyframes shimmer { to { background-position: -200% 0; } }

        .ai-result { display: flex; flex-direction: column; gap: 16px; margin-top: 6px; }

        .ai-summary-box {
          display: flex; gap: 12px; align-items: flex-start;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          border-left: 4px solid #6366f1;
          border-radius: 10px;
          padding: 14px 16px;
        }
        .ai-summary-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
        .ai-summary-text { font-size: 0.9rem; line-height: 1.6; color: #c7d2fe; margin: 0; white-space: pre-wrap; }

        .ai-viz-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 20px;
        }
        .ai-viz-title {
          font-size: 0.95rem; font-weight: 600; color: #94a3b8;
          margin: 0 0 16px 0;
        }

        /* Table */
        .ai-table-wrap { overflow-x: auto; }
        .ai-table {
          width: 100%; border-collapse: collapse; font-size: 0.85rem;
        }
        .ai-table th {
          background: rgba(99,102,241,0.15);
          color: #a5b4fc;
          padding: 10px 14px;
          text-align: left;
          font-weight: 600;
          border-bottom: 1px solid rgba(99,102,241,0.2);
        }
        .ai-table td {
          padding: 9px 14px;
          color: #cbd5e1;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .ai-table tr:hover td { background: rgba(99,102,241,0.07); }

        .ai-empty { color: #475569; font-size: 0.85rem; text-align: center; padding: 20px 0; }

        .ai-tooltip {
          background: #1e293b;
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 0.82rem;
        }
        .ai-tooltip-label { font-weight: 600; color: #94a3b8; margin-bottom: 4px; }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, TrendingUp, Target, Zap, ChevronRight, AlertTriangle, Star, BarChart2, RefreshCw, Sparkles } from "lucide-react";
import moment from "moment";

// ─── helpers ────────────────────────────────────────────────────────────────

function pct(n, d) { return d > 0 ? ((n / d) * 100).toFixed(1) : "0.0"; }
function usd(n) { return `US$ ${(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function daysLeft() {
  const now = moment();
  return now.daysInMonth() - now.date();
}

// ─── mini components ────────────────────────────────────────────────────────

function KPIBlock({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "20px 24px",
    }}>
      <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: accent || "#f9fafb", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

function RankRow({ rank, name, value, sub, bar, barColor, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: rank === 1 ? "#fbbf24" : "#4b5563", minWidth: 20 }}>#{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
          {badge && <span style={{ fontSize: 10, background: "#fbbf2422", color: "#fbbf24", border: "1px solid #fbbf2444", borderRadius: 4, padding: "1px 6px" }}>{badge}</span>}
        </div>
        {sub && <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{sub}</p>}
        {bar !== undefined && (
          <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: 6 }}>
            <div style={{ height: 3, width: `${Math.min(bar, 100)}%`, background: barColor || "#10b981", borderRadius: 2, transition: "width 0.8s ease" }} />
          </div>
        )}
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb", minWidth: 80, textAlign: "right" }}>{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children, action }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: 28,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={16} color="#818cf8" />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb", letterSpacing: "0.02em" }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── AI Analysis Component ───────────────────────────────────────────────────

function AIInsights({ data }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const abortRef = useRef(null);

  const runAnalysis = async () => {
    if (loading) return;
    setLoading(true);
    setDone(false);
    setAnalysis("");

    const prompt = `Sos un analista de negocios senior especializado en comercio de tecnología (Apple reseller en Argentina). 
Analizá estos datos del CRM y dá recomendaciones concretas y accionables en español rioplatense informal pero profesional.

DATOS DEL NEGOCIO (últimos 30 días):
- Ventas totales: ${data.totalVentas} ventas | Ganancia: ${usd(data.totalGanancia)}
- Tasa de conversión: ${data.tasaConversion}% (${data.totalConsultas} consultas → ${data.totalVentas} ventas)
- Ticket promedio: ${usd(data.ticketPromedio)}
- Ganancia promedio por venta: ${usd(data.gananciaProm)}

TOP PRODUCTOS (por ganancia):
${data.topProductos.slice(0, 5).map((p, i) => `  ${i + 1}. ${p.name}: ${usd(p.ganancia)} | Margen: ${p.margen}%`).join("\n")}

TOP PROVEEDORES (por ganancia):
${data.topProveedores.slice(0, 4).map((p, i) => `  ${i + 1}. ${p.name}: ${usd(p.ganancia)} (${p.compras} compras, margen ${p.margen}%)`).join("\n")}

CANALES (por cantidad de ventas):
${data.canales.slice(0, 4).map(c => `  ${c.name}: ${c.ventas} ventas, conversión ${c.conversion}%, ganancia ${usd(c.ganancia)}`).join("\n")}

CONSULTAS POR ESTADO:
${data.etapas.map(e => `  ${e.etapa}: ${e.count}`).join("\n")}

Respondé con 3 secciones cortas y directas:
1. **Lo que está funcionando bien** (2-3 puntos)
2. **Lo que hay que mejorar urgente** (2-3 puntos con acciones concretas)
3. **La recomendación más importante del mes** (1 sola cosa, la más impactante)

Sé específico con los números. No uses frases genéricas. Máximo 350 palabras.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          stream: true,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const json = JSON.parse(raw);
              if (json.type === "content_block_delta" && json.delta?.text) {
                setAnalysis(prev => prev + json.delta.text);
              }
            } catch {}
          }
        }
      }
      setDone(true);
    } catch (err) {
      setAnalysis("Error al conectar con la IA. Verificá tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  // Formato de markdown básico
  const formatText = (text) => {
    return text
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("**") && line.includes("**", 2)) {
          const parts = line.split("**");
          return (
            <p key={i} style={{ marginTop: i === 0 ? 0 : 16, marginBottom: 4 }}>
              {parts.map((p, j) => j % 2 === 1
                ? <strong key={j} style={{ color: "#c7d2fe", fontWeight: 700 }}>{p}</strong>
                : <span key={j}>{p}</span>
              )}
            </p>
          );
        }
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} style={{ margin: "4px 0" }}>{line}</p>;
      });
  };

  return (
    <Section title="Análisis IA del Negocio" icon={Sparkles}
      action={
        <button onClick={runAnalysis} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: loading ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.8)",
          border: "none", borderRadius: 8, padding: "7px 14px",
          color: "#fff", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s"
        }}>
          {loading ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
          {loading ? "Analizando..." : done ? "Actualizar análisis" : "Generar análisis"}
        </button>
      }
    >
      {!analysis && !loading && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Sparkles size={24} color="#818cf8" />
          </div>
          <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 320, margin: "0 auto" }}>
            Hacé clic en "Generar análisis" para que la IA analice tus datos y te dé recomendaciones concretas.
          </p>
        </div>
      )}

      {(analysis || loading) && (
        <div style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 12,
          padding: "20px 24px",
          fontSize: 13,
          lineHeight: 1.7,
          color: "#d1d5db",
          minHeight: loading && !analysis ? 80 : "auto"
        }}>
          {loading && !analysis && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#818cf8" }}>
              <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13 }}>Analizando datos del negocio...</span>
            </div>
          )}
          {formatText(analysis)}
          {loading && analysis && (
            <span style={{ display: "inline-block", width: 8, height: 16, background: "#818cf8", marginLeft: 2, animation: "blink 0.8s step-end infinite", borderRadius: 1 }} />
          )}
        </div>
      )}
    </Section>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InteligenciaNegocio() {
  const { workspace } = useWorkspace();
  const [objetivo, setObjetivo] = useState("");
  const [diasHabiles, setDiasHabiles] = useState(String(Math.round(daysLeft() * 0.7)));

  const { data: ventas = [] } = useQuery({
    queryKey: ["ib-ventas", workspace?.id],
    queryFn: () => workspace ? base44.entities.Venta.filter({ workspace_id: workspace.id, estado: "Finalizada" }, "-fecha", 1000) : [],
    enabled: !!workspace
  });

  const { data: consultas = [] } = useQuery({
    queryKey: ["ib-consultas", workspace?.id],
    queryFn: () => workspace ? base44.entities.Consulta.filter({ workspace_id: workspace.id }, "-created_date", 2000) : [],
    enabled: !!workspace
  });

  // ── ventana de 30 días ──
  const cut30 = moment().subtract(30, "days");
  const ventas30 = ventas.filter(v => moment(v.fecha).isAfter(cut30));
  const consultas30 = consultas.filter(c => moment(c.created_date).isAfter(cut30));
  const concretados30 = consultas30.filter(c => c.etapa === "Concretado");

  const totalVentas = ventas30.length;
  const totalConsultas = consultas30.length;
  const totalGanancia = ventas30.reduce((s, v) => s + (v.ganancia || 0), 0);
  const totalVentaMonto = ventas30.reduce((s, v) => s + (v.venta || 0), 0);
  const tasaConversion = parseFloat(pct(concretados30.length, totalConsultas));
  const ticketPromedio = totalVentas > 0 ? totalVentaMonto / totalVentas : 0;
  const gananciaProm = totalVentas > 0 ? totalGanancia / totalVentas : 0;

  // ── por mes actual ──
  const cutMes = moment().startOf("month");
  const ventasMes = ventas.filter(v => moment(v.fecha).isAfter(cutMes));
  const gananciaMes = ventasMes.reduce((s, v) => s + (v.ganancia || 0), 0);

  // ── top productos ──
  const prodMap = {};
  ventas30.forEach(v => {
    const k = v.productoSnapshot || v.modelo || "Sin especificar";
    if (!prodMap[k]) prodMap[k] = { ganancia: 0, venta: 0, count: 0 };
    prodMap[k].ganancia += v.ganancia || 0;
    prodMap[k].venta += v.venta || 0;
    prodMap[k].count++;
  });
  const topProductos = Object.entries(prodMap)
    .map(([name, d]) => ({ name, ganancia: d.ganancia, margen: d.venta > 0 ? ((d.ganancia / d.venta) * 100).toFixed(1) : "0", count: d.count }))
    .sort((a, b) => b.ganancia - a.ganancia);
  const maxProdGanancia = topProductos[0]?.ganancia || 1;

  // ── top proveedores ──
  const provMap = {};
  ventas30.forEach(v => {
    const k = v.proveedorNombreSnapshot || v.proveedorTexto || "Sin especificar";
    if (!provMap[k]) provMap[k] = { ganancia: 0, venta: 0, costo: 0, compras: 0 };
    provMap[k].ganancia += v.ganancia || 0;
    provMap[k].venta += v.venta || 0;
    provMap[k].costo += v.costo || 0;
    provMap[k].compras++;
  });
  const topProveedores = Object.entries(provMap)
    .map(([name, d]) => ({ name, ganancia: d.ganancia, margen: d.venta > 0 ? ((d.ganancia / d.venta) * 100).toFixed(1) : "0", compras: d.compras }))
    .sort((a, b) => b.ganancia - a.ganancia);
  const maxProvGanancia = topProveedores[0]?.ganancia || 1;

  // ── canales ──
  const canalMap = {};
  consultas30.forEach(c => {
    const k = c.canalOrigen || "Sin especificar";
    if (!canalMap[k]) canalMap[k] = { consultas: 0, concretados: 0 };
    canalMap[k].consultas++;
    if (c.etapa === "Concretado") canalMap[k].concretados++;
  });
  ventas30.forEach(v => {
    const k = v.marketplace || "Sin especificar";
    if (!canalMap[k]) canalMap[k] = { consultas: 0, concretados: 0, ganancia: 0 };
    canalMap[k].ganancia = (canalMap[k].ganancia || 0) + (v.ganancia || 0);
  });
  const canales = Object.entries(canalMap)
    .map(([name, d]) => ({
      name,
      ventas: d.concretados,
      conversion: pct(d.concretados, d.consultas),
      ganancia: d.ganancia || 0
    }))
    .sort((a, b) => b.ganancia - a.ganancia);
  const maxCanalGanancia = canales[0]?.ganancia || 1;

  // ── etapas activas ──
  const etapaMap = {};
  consultas.forEach(c => {
    const k = c.etapa || "Sin etapa";
    etapaMap[k] = (etapaMap[k] || 0) + 1;
  });
  const etapas = Object.entries(etapaMap).map(([etapa, count]) => ({ etapa, count })).sort((a, b) => b.count - a.count);

  // ── predicción / tendencia ──
  // últimos 3 meses vs mes actual
  const meses = [0, 1, 2, 3].map(i => {
    const start = moment().subtract(i, "months").startOf("month");
    const end = moment().subtract(i, "months").endOf("month");
    const mv = ventas.filter(v => moment(v.fecha).isBetween(start, end, null, "[]"));
    return {
      label: start.format("MMM"),
      ganancia: mv.reduce((s, v) => s + (v.ganancia || 0), 0),
      count: mv.length
    };
  }).reverse();

  const tendencia = meses.length >= 2 ? ((meses[3].ganancia - meses[2].ganancia) / (meses[2].ganancia || 1) * 100).toFixed(1) : 0;
  const tendenciaPositiva = parseFloat(tendencia) >= 0;
  const maxMesGanancia = Math.max(...meses.map(m => m.ganancia), 1);

  // ── calculadora de llamadas ──
  const objNum = parseFloat(objetivo) || 0;
  const diasNum = parseFloat(diasHabiles) || 1;
  const faltaGanar = Math.max(0, objNum - gananciaMes);
  const ventasNecesarias = gananciaProm > 0 ? Math.ceil(faltaGanar / gananciaProm) : 0;
  const consultasNecesarias = tasaConversion > 0 ? Math.ceil(ventasNecesarias / (tasaConversion / 100)) : 0;
  const llamadasPorDia = diasNum > 0 ? Math.ceil(consultasNecesarias / diasNum) : 0;
  const yaAlcanzado = faltaGanar <= 0;

  // data para IA
  const aiData = { totalVentas, totalConsultas, totalGanancia, tasaConversion, ticketPromedio, gananciaProm, topProductos, topProveedores, canales, etapas };

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e5e7eb",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      padding: "0 0 80px",
    },
    header: {
      background: "rgba(255,255,255,0.02)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "20px 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 10,
      backdropFilter: "blur(12px)",
    },
    content: { maxWidth: 1200, margin: "0 auto", padding: "32px 32px 0" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 },
    grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 },
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to={createPageUrl("Home")}>
            <button style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 12px", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <ArrowLeft size={14} /> Volver
            </button>
          </Link>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb", margin: 0 }}>Inteligencia de Negocio</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Solo para administradores · Datos en tiempo real</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.05em" }}>ÚLTIMOS 30 DÍAS</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
        </div>
      </div>

      <div style={styles.content}>

        {/* KPIs principales */}
        <div style={{ ...styles.grid4, marginBottom: 24, animation: "fadeUp 0.4s ease" }}>
          <KPIBlock label="Ganancia del mes" value={usd(gananciaMes)} sub={`${ventasMes.length} ventas este mes`} accent="#10b981" />
          <KPIBlock label="Tasa de conversión" value={`${tasaConversion}%`} sub={`${concretados30.length} de ${totalConsultas} consultas`} accent="#818cf8" />
          <KPIBlock label="Ticket promedio" value={usd(ticketPromedio)} sub="por venta" />
          <KPIBlock label="Ganancia por venta" value={usd(gananciaProm)} sub="promedio últimos 30 días" accent="#fbbf24" />
        </div>

        {/* Calculadora de llamadas */}
        <div style={{ animation: "fadeUp 0.5s ease", marginBottom: 24 }}>
          <Section title="Calculadora de Llamadas Diarias" icon={Target}
            action={
              <span style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.05em" }}>
                {daysLeft()} días restantes en el mes
              </span>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  Objetivo de ganancia mensual (USD)
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: 13 }}>US$</span>
                  <input
                    type="number"
                    value={objetivo}
                    onChange={e => setObjetivo(e.target.value)}
                    placeholder="0"
                    style={{
                      width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10, padding: "12px 14px 12px 38px", color: "#f9fafb", fontSize: 15,
                      fontWeight: 600, outline: "none", fontFamily: "'DM Mono', monospace"
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  Días hábiles restantes
                </label>
                <input
                  type="number"
                  value={diasHabiles}
                  onChange={e => setDiasHabiles(e.target.value)}
                  style={{
                    width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10, padding: "12px 14px", color: "#f9fafb", fontSize: 15,
                    fontWeight: 600, outline: "none", fontFamily: "'DM Mono', monospace"
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  Ya ganado este mes
                </label>
                <div style={{
                  background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10, padding: "12px 14px", color: "#10b981", fontSize: 15,
                  fontWeight: 700, fontFamily: "'DM Mono', monospace"
                }}>
                  {usd(gananciaMes)}
                </div>
              </div>
            </div>

            {objNum > 0 && (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16,
                padding: 20, background: yaAlcanzado ? "rgba(16,185,129,0.06)" : "rgba(99,102,241,0.06)",
                border: `1px solid ${yaAlcanzado ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.2)"}`,
                borderRadius: 12
              }}>
                {yaAlcanzado ? (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "12px 0" }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "#10b981" }}>🎉 ¡Objetivo alcanzado este mes!</p>
                    <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Ganaste {usd(gananciaMes)} de un objetivo de {usd(objNum)}</p>
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Falta ganar</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{usd(faltaGanar)}</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Ventas necesarias</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: "#e5e7eb" }}>{ventasNecesarias}</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Consultas necesarias</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: "#e5e7eb" }}>{consultasNecesarias}</p>
                      <p style={{ fontSize: 10, color: "#6b7280" }}>con {tasaConversion}% conversión</p>
                    </div>
                    <div style={{ textAlign: "center", background: "rgba(99,102,241,0.15)", borderRadius: 10, padding: "12px 8px" }}>
                      <p style={{ fontSize: 11, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Contactos por día</p>
                      <p style={{ fontSize: 32, fontWeight: 800, color: "#c7d2fe", lineHeight: 1 }}>{llamadasPorDia}</p>
                      <p style={{ fontSize: 10, color: "#818cf8", marginTop: 4 }}>en {diasNum} días hábiles</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {objNum === 0 && (
              <div style={{ textAlign: "center", padding: "16px 0", color: "#4b5563", fontSize: 13 }}>
                Ingresá tu objetivo mensual para ver cuántos contactos necesitás hacer por día.
              </div>
            )}
          </Section>
        </div>

        {/* Rentabilidad */}
        <div style={{ ...styles.grid2, marginBottom: 24, animation: "fadeUp 0.55s ease" }}>
          {/* Top Productos */}
          <Section title="Rentabilidad por Producto" icon={BarChart2}>
            {topProductos.length === 0 ? (
              <p style={{ color: "#4b5563", fontSize: 13, textAlign: "center", padding: "24px 0" }}>Sin datos en los últimos 30 días</p>
            ) : (
              topProductos.slice(0, 8).map((p, i) => (
                <RankRow
                  key={p.name} rank={i + 1} name={p.name}
                  value={usd(p.ganancia)}
                  sub={`Margen ${p.margen}% · ${p.count} unidades`}
                  bar={(p.ganancia / maxProdGanancia) * 100}
                  barColor={i === 0 ? "#fbbf24" : "#10b981"}
                  badge={i === 0 ? "TOP" : null}
                />
              ))
            )}
          </Section>

          {/* Top Proveedores */}
          <Section title="Rentabilidad por Proveedor" icon={TrendingUp}>
            {topProveedores.length === 0 ? (
              <p style={{ color: "#4b5563", fontSize: 13, textAlign: "center", padding: "24px 0" }}>Sin datos en los últimos 30 días</p>
            ) : (
              topProveedores.slice(0, 8).map((p, i) => (
                <RankRow
                  key={p.name} rank={i + 1} name={p.name}
                  value={usd(p.ganancia)}
                  sub={`${p.compras} compras · margen ${p.margen}%`}
                  bar={(p.ganancia / maxProvGanancia) * 100}
                  barColor={i === 0 ? "#fbbf24" : "#818cf8"}
                  badge={i === 0 ? "MEJOR" : null}
                />
              ))
            )}
          </Section>
        </div>

        {/* Canales + Tendencia */}
        <div style={{ ...styles.grid2, marginBottom: 24, animation: "fadeUp 0.6s ease" }}>
          {/* Canales */}
          <Section title="Rendimiento por Canal" icon={Zap}>
            {canales.length === 0 ? (
              <p style={{ color: "#4b5563", fontSize: 13, textAlign: "center", padding: "24px 0" }}>Sin datos</p>
            ) : (
              canales.slice(0, 6).map((c, i) => (
                <RankRow
                  key={c.name} rank={i + 1} name={c.name}
                  value={usd(c.ganancia)}
                  sub={`${c.ventas} ventas · conversión ${c.conversion}%`}
                  bar={(c.ganancia / maxCanalGanancia) * 100}
                  barColor={["#818cf8", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6"][i] || "#818cf8"}
                />
              ))
            )}
          </Section>

          {/* Tendencia mensual */}
          <Section title="Tendencia Mensual" icon={TrendingUp}
            action={
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                background: tendenciaPositiva ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color: tendenciaPositiva ? "#10b981" : "#ef4444",
              }}>
                {tendenciaPositiva ? "↑" : "↓"} {Math.abs(tendencia)}% vs mes anterior
              </span>
            }
          >
            {/* Gráfico de barras manual */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 140, marginBottom: 20 }}>
              {meses.map((m, i) => {
                const h = maxMesGanancia > 0 ? (m.ganancia / maxMesGanancia) * 120 : 4;
                const isActual = i === meses.length - 1;
                return (
                  <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <p style={{ fontSize: 10, color: "#6b7280" }}>{usd(m.ganancia)}</p>
                    <div style={{
                      width: "100%", height: Math.max(h, 4),
                      background: isActual ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.08)",
                      borderRadius: "6px 6px 0 0",
                      border: isActual ? "1px solid rgba(129,140,248,0.5)" : "none",
                      transition: "height 0.8s ease",
                      position: "relative",
                    }}>
                      {isActual && (
                        <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#818cf8", whiteSpace: "nowrap" }}>
                          MES ACTUAL
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: 12, fontWeight: isActual ? 700 : 400, color: isActual ? "#e5e7eb" : "#6b7280" }}>{m.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Mini stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Mejor mes", value: usd(Math.max(...meses.map(m => m.ganancia))) },
                { label: "Promedio mensual", value: usd(meses.reduce((s, m) => s + m.ganancia, 0) / 4) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 14px" }}>
                  <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb" }}>{value}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* IA Analysis — full width */}
        <div style={{ animation: "fadeUp 0.65s ease", marginBottom: 24 }}>
          <AIInsights data={aiData} />
        </div>

      </div>
    </div>
  );
}

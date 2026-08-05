import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Building2, CheckCircle2, Clock3, Save, Send } from "lucide-react";
import { useParams } from "react-router-dom";
import { AppDateInput, AppInput } from "@/components/shared/AppInput";
import { formatProjectDate, formatProjectNumber } from "@/lib/project-format";
import { procurementApi } from "./api";
import type { SupplierPortalQuote } from "./types";

type PortalForm = Pick<
  SupplierPortalQuote,
  | "quoteNo"
  | "quoteDate"
  | "validUntil"
  | "currencyCode"
  | "exchangeRate"
  | "note"
  | "lines"
>;

export function SupplierQuotePortalPage(): ReactElement {
  const { token = "" } = useParams();
  const [quote, setQuote] = useState<SupplierPortalQuote>();
  const [form, setForm] = useState<PortalForm>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void procurementApi
      .portalGet(token)
      .then((x) => {
        setQuote(x);
        setForm({
          quoteNo: x.quoteNo ?? "",
          quoteDate: x.quoteDate ?? new Date().toLocaleDateString("en-CA"),
          validUntil: x.validUntil,
          currencyCode: x.currencyCode,
          exchangeRate: x.exchangeRate,
          note: x.note,
          lines: x.lines,
        });
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Teklif bağlantısı açılamadı.",
        ),
      );
  }, [token]);
  const total = useMemo(
    () =>
      form?.lines.reduce(
        (sum, x) =>
          sum +
          x.quotedQuantity *
            x.unitPrice *
            (1 - x.discountRate / 100) *
            (1 + x.vatRate / 100),
        0,
      ) ?? 0,
    [form],
  );
  const patch = (key: keyof PortalForm, value: unknown) =>
    setForm((x) => (x ? { ...x, [key]: value } : x));
  const patchLine = (
    id: number,
    key:
      | "quotedQuantity"
      | "unitPrice"
      | "discountRate"
      | "vatRate"
      | "deliveryDate",
    value: number | string,
  ) =>
    setForm((x) =>
      x
        ? {
            ...x,
            lines: x.lines.map((line) =>
              line.rfqLineId === id ? { ...line, [key]: value } : line,
            ),
          }
        : x,
    );
  const payload = () =>
    form && {
      quoteNo: form.quoteNo || null,
      quoteDate: form.quoteDate || null,
      validUntil: form.validUntil || null,
      currencyCode: form.currencyCode,
      exchangeRate: form.exchangeRate,
      note: form.note || null,
      lines: form.lines.map((x) => ({
        rfqLineId: x.rfqLineId,
        quantity: x.quotedQuantity,
        unitPrice: x.unitPrice,
        discountRate: x.discountRate,
        vatRate: x.vatRate,
        deliveryDate: x.deliveryDate || null,
      })),
    };
  const save = async (submit: boolean) => {
    const body = payload();
    if (!body) return;
    if (submit && !String(form?.quoteNo ?? "").trim()) {
      setError("Teklif numarası zorunludur.");
      return;
    }
    if (
      submit &&
      !quote?.allowZeroUnitPrice &&
      body.lines.some((x) => x.unitPrice <= 0)
    ) {
      setError("Tüm kalemler için sıfırdan büyük birim fiyat girilmelidir.");
      return;
    }
    if (
      submit &&
      quote?.requireDeliveryDate &&
      body.lines.some((x) => !x.deliveryDate)
    ) {
      setError("Tüm kalemler için teslim tarihi zorunludur.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (submit) await procurementApi.portalSubmit(token, body);
      else await procurementApi.portalSave(token, body);
      setMessage(
        submit
          ? "Teklifiniz satınalma ekibine gönderildi."
          : "Taslağınız güvenli şekilde kaydedildi.",
      );
      if (submit) setQuote((x) => (x ? { ...x, status: "Submitted" } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };
  if (error && !quote)
    return (
      <PortalShell>
        <StateCard title="Bağlantı açılamadı" text={error} />
      </PortalShell>
    );
  if (!quote || !form)
    return (
      <PortalShell>
        <StateCard
          title="Teklif talebi yükleniyor"
          text="Güvenli bağlantı doğrulanıyor…"
        />
      </PortalShell>
    );
  const locked = quote.status === "Submitted";
  return (
    <PortalShell>
      <main className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-cyan-500/20 bg-slate-950/85 p-5 shadow-2xl backdrop-blur sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
                V3RII WMS · TEDARİKÇİ TEKLİF PORTALI
              </p>
              <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                {quote.rfqNo} · {quote.subject}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {quote.supplierCode} · {quote.supplierName}
              </p>
            </div>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300">
              Revizyon {quote.revisionNo}
            </span>
          </div>
          {quote.buyerMessage ? (
            <p className="mt-5 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
              {quote.buyerMessage}
            </p>
          ) : null}
        </header>
        <section className="grid gap-3 sm:grid-cols-3">
          <Metric
            icon={<Building2 />}
            label="Tedarikçi"
            value={quote.supplierName}
          />
          <Metric
            icon={<Clock3 />}
            label="Cevap son tarihi"
            value={formatProjectDate(quote.responseDueDate)}
          />
          <Metric
            icon={<CheckCircle2 />}
            label="Durum"
            value={locked ? "Teklif gönderildi" : "Fiyat girişi açık"}
          />
        </section>
        <section className="rounded-2xl border border-slate-700 bg-slate-950/85 p-4 shadow-xl sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Teklif numarası *">
              <AppInput
                disabled={locked}
                value={form.quoteNo ?? ""}
                onChange={(e) => patch("quoteNo", e.target.value)}
              />
            </Field>
            <Field label="Teklif tarihi">
              <AppDateInput
                disabled={locked}
                value={form.quoteDate ?? ""}
                onChange={(e) => patch("quoteDate", e.target.value)}
              />
            </Field>
            <Field label="Geçerlilik tarihi">
              <AppDateInput
                disabled={locked}
                value={form.validUntil ?? ""}
                onChange={(e) => patch("validUntil", e.target.value)}
              />
            </Field>
            <Field label="Para birimi">
              <AppInput
                disabled={locked}
                maxLength={3}
                value={form.currencyCode}
                onChange={(e) =>
                  patch("currencyCode", e.target.value.toUpperCase())
                }
              />
            </Field>
            <Field label="Kur">
              <AppInput
                disabled={locked}
                type="number"
                min="0.000001"
                step="any"
                value={form.exchangeRate}
                onChange={(e) => patch("exchangeRate", Number(e.target.value))}
              />
            </Field>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-700 bg-slate-950/85 p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Teklif kalemleri</h2>
              <p className="text-sm text-slate-400">
                Miktar, fiyat, iskonto, vergi ve teslim tarihini kalem bazında
                girin.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-slate-500">Genel toplam</p>
              <p className="text-2xl font-black text-cyan-400">
                {formatProjectNumber(total)} {form.currencyCode}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {form.lines.map((line) => (
              <article
                key={line.rfqLineId}
                className="rounded-xl border border-slate-700 p-4"
              >
                <div className="mb-4">
                  <p className="text-xs text-slate-500">Kalem {line.lineNo}</p>
                  <h3 className="font-bold text-white">
                    {line.stockCode ? `${line.stockCode} · ` : ""}
                    {line.stockName}
                  </h3>
                  <p className="text-sm text-slate-400">
                    İstenen: {formatProjectNumber(line.requestedQuantity)}{" "}
                    {line.unitCode}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Teklif miktarı">
                    <AppInput
                      disabled={locked || !quote.allowQuantityChange}
                      type="number"
                      min="0.000001"
                      max={line.requestedQuantity}
                      step="any"
                      value={line.quotedQuantity}
                      onChange={(e) =>
                        patchLine(
                          line.rfqLineId,
                          "quotedQuantity",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                  <Field label="Birim fiyat">
                    <AppInput
                      disabled={locked}
                      type="number"
                      min={quote.allowZeroUnitPrice ? "0" : "0.000001"}
                      step="any"
                      value={line.unitPrice}
                      onChange={(e) =>
                        patchLine(
                          line.rfqLineId,
                          "unitPrice",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                  <Field label="İskonto %">
                    <AppInput
                      disabled={locked}
                      type="number"
                      min="0"
                      max="100"
                      value={line.discountRate}
                      onChange={(e) =>
                        patchLine(
                          line.rfqLineId,
                          "discountRate",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                  <Field label="KDV %">
                    <AppInput
                      disabled={locked}
                      type="number"
                      min="0"
                      value={line.vatRate}
                      onChange={(e) =>
                        patchLine(
                          line.rfqLineId,
                          "vatRate",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                  <Field
                    label={`Teslim tarihi${quote.requireDeliveryDate ? " *" : ""}`}
                  >
                    <AppDateInput
                      disabled={locked}
                      value={line.deliveryDate ?? ""}
                      onChange={(e) =>
                        patchLine(
                          line.rfqLineId,
                          "deliveryDate",
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-700 bg-slate-950/85 p-4 shadow-xl sm:p-6">
          <Field label="Teklif ve teslim notları">
            <textarea
              disabled={locked}
              className="app-input min-h-28 w-full resize-y"
              value={form.note ?? ""}
              onChange={(e) => patch("note", e.target.value)}
            />
          </Field>
          {error ? (
            <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {message}
            </p>
          ) : null}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!locked ? (
              <>
                {quote.allowDraftSave ? (
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void save(false)}
                  >
                    <Save size={16} /> Taslak kaydet
                  </button>
                ) : null}
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  <Send size={16} /> Teklifi gönder
                </button>
              </>
            ) : (
              <p className="font-semibold text-emerald-400">
                Teklifiniz alınmıştır. Revizyon için satınalma sorumlunuzla
                iletişime geçin.
              </p>
            )}
          </div>
        </section>
      </main>
    </PortalShell>
  );
}
function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,.16),transparent_35%)] p-3 text-slate-200 sm:p-6">
      {children}
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/85 p-4">
      <span className="text-cyan-400">{icon}</span>
      <span>
        <small className="block uppercase text-slate-500">{label}</small>
        <b className="text-white">{value}</b>
      </span>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
function StateCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto mt-24 max-w-xl rounded-2xl border border-slate-700 bg-slate-950 p-8 text-center">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <p className="mt-3 text-slate-400">{text}</p>
    </div>
  );
}

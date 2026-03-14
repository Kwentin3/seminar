import type {
  ApiError,
  CabinetMaterialDetailResponse,
  CabinetMaterialSimplifyResponse,
  CabinetMaterialSimplifyState,
  CabinetMaterialStatus
} from "@seminar/contracts";
import { SectionCard } from "@seminar/ui";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Link, useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import type { AppMessages } from "../app/messages";
import { useAppContext } from "../app/useAppContext";

type ReaderStatus = "loading" | "ready" | "error" | "not-found";
type SimplifyFetchStatus = "idle" | "loading" | "ready" | "error";
type ReaderViewMode = "original" | "simplified";

const ARTICLE_CLASS_NAME =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-5 [&_a]:text-sky-700 [&_a]:underline [&_a]:underline-offset-4 dark:[&_a]:text-sky-300 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic dark:[&_blockquote]:border-slate-700 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.95em] dark:[&_code]:bg-slate-800 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:first:mt-0 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_hr]:my-8 [&_hr]:border-slate-200 dark:[&_hr]:border-slate-700 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 dark:[&_img]:border-slate-700 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_tbody_tr:nth-child(odd)]:bg-slate-50 dark:[&_tbody_tr:nth-child(odd)]:bg-slate-800/60 [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-slate-700 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-800 [&_ul]:list-disc [&_ul]:pl-6";

export function CabinetMaterialPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { messages } = useAppContext();

  const [status, setStatus] = useState<ReaderStatus>("loading");
  const [item, setItem] = useState<CabinetMaterialDetailResponse["item"] | null>(null);
  const [errorCode, setErrorCode] = useState<ApiError["code"] | null>(null);
  const [viewMode, setViewMode] = useState<ReaderViewMode>("original");
  const [simplifyFetchStatus, setSimplifyFetchStatus] = useState<SimplifyFetchStatus>("idle");
  const [simplifyState, setSimplifyState] = useState<CabinetMaterialSimplifyState | null>(null);
  const [simplifyErrorCode, setSimplifyErrorCode] = useState<ApiError["code"] | null>(null);
  const [simplifyActionBusy, setSimplifyActionBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/cabinet/materials/${slug}`, {
          credentials: "include"
        });

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          navigate(`/cabinet/login?next=${encodeURIComponent(`/cabinet/materials/${slug ?? ""}`)}`, {
            replace: true
          });
          return;
        }

        if (response.status === 404) {
          setStatus("not-found");
          return;
        }

        if (!response.ok) {
          const error = await readApiError(response);
          setErrorCode(error.code);
          setStatus("error");
          return;
        }

        const payload = (await response.json()) as CabinetMaterialDetailResponse;
        if (cancelled) {
          return;
        }

        setItem(payload.item);
        setStatus("ready");
        setViewMode("original");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorCode("internal_error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, slug]);

  useEffect(() => {
    if (status !== "ready" || !item?.content) {
      setSimplifyFetchStatus("idle");
      setSimplifyState(null);
      setSimplifyErrorCode(null);
      return;
    }

    let cancelled = false;
    setSimplifyFetchStatus("loading");
    setSimplifyErrorCode(null);

    void (async () => {
      try {
        const result = await fetchSimplifyState(item.slug);
        if (cancelled) {
          return;
        }

        if (result.kind === "unauthorized") {
          navigate(`/cabinet/login?next=${encodeURIComponent(`/cabinet/materials/${item.slug}`)}`, {
            replace: true
          });
          return;
        }

        if (result.kind === "error") {
          setSimplifyFetchStatus("error");
          setSimplifyErrorCode(result.error.code);
          return;
        }

        setSimplifyState(result.state);
        setSimplifyFetchStatus("ready");
      } catch {
        if (!cancelled) {
          setSimplifyFetchStatus("error");
          setSimplifyErrorCode("internal_error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item?.content, item?.slug, navigate, status]);

  useEffect(() => {
    if (!item?.content || simplifyState?.status !== "generating") {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchSimplifyState(item.slug);
          if (cancelled) {
            return;
          }

          if (result.kind === "ok") {
            setSimplifyState(result.state);
            setSimplifyFetchStatus("ready");
          } else if (result.kind === "error") {
            setSimplifyFetchStatus("error");
            setSimplifyErrorCode(result.error.code);
          }
        } catch {
          if (!cancelled) {
            setSimplifyFetchStatus("error");
            setSimplifyErrorCode("internal_error");
          }
        }
      })();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [item?.content, item?.slug, simplifyState?.status]);

  if (status === "loading") {
    return <SectionCard title={messages.cabinet.reader.loading}>{messages.cabinet.reader.loading}</SectionCard>;
  }

  if (status === "error") {
    return (
      <SectionCard title={messages.cabinet.library.heading}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {messages.cabinet.reader.errors.generic}
            {errorCode ? ` (${errorCode})` : ""}
          </p>
          <Link
            to="/cabinet"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-900"
          >
            {messages.cabinet.reader.backToLibrary}
          </Link>
        </div>
      </SectionCard>
    );
  }

  if (status === "not-found" || !item) {
    return (
      <SectionCard title={messages.cabinet.library.heading}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">{messages.cabinet.reader.errors.notFound}</p>
          <Link
            to="/cabinet"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-900"
          >
            {messages.cabinet.reader.backToLibrary}
          </Link>
        </div>
      </SectionCard>
    );
  }

  const prepCue = item.recommended_for_lecture_prep ? getPrepCue(messages.cabinet.reader.prepCues, item.material_status) : null;
  const visibleTags = item.tags.slice(0, 6);
  const remainingTagCount = Math.max(item.tags.length - visibleTags.length, 0);
  const readerMetaLine = [
    item.curation_reviewed_at ? `${messages.cabinet.reader.fields.curated}: ${item.curation_reviewed_at}` : null,
    item.source_updated_at ? `${messages.cabinet.reader.fields.updated}: ${item.source_updated_at}` : null
  ].filter(Boolean);
  const canSimplify = Boolean(item.content);
  const simplifyMessages = messages.cabinet.reader.simplify;
  const simplifyDisabled = simplifyActionBusy || simplifyFetchStatus === "loading";

  return (
    <div className="space-y-6">
      <SectionCard title={item.title} description={item.summary ?? messages.cabinet.library.description}>
        <div className="space-y-5">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60 sm:p-4">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClassName(item.material_status)}`}>
                {getStatusLabel(messages.cabinet.reader.statuses, item.material_status)}
              </span>
              {item.recommended_for_lecture_prep ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {messages.cabinet.reader.recommendedForPrep}
                </span>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.reading_mode === "in_app"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {item.reading_mode === "in_app"
                  ? messages.cabinet.library.readableInPortal
                  : messages.cabinet.library.externalOnly}
              </span>
            </div>

            {prepCue ? <p className="text-sm text-slate-700 dark:text-slate-200">{prepCue}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              {canSimplify ? (
                <button
                  type="button"
                  onClick={() => void openSimplifiedView()}
                  disabled={simplifyDisabled}
                  className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                >
                  {simplifyActionBusy ? simplifyMessages.loadingState : simplifyMessages.action}
                </button>
              ) : null}
              <Link
                to="/cabinet"
                className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
              >
                {messages.cabinet.reader.backToLibrary}
              </Link>
              <a
                href={item.open_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
              >
                {item.reading_mode === "in_app"
                  ? messages.cabinet.reader.sourceLink
                  : messages.cabinet.reader.openExternally}
              </a>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {messages.cabinet.reader.quickFactsHeading}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <QuickFact label={messages.cabinet.reader.fields.theme} value={item.theme ?? item.category} />
                <QuickFact label={messages.cabinet.reader.fields.type} value={item.material_type} />
              </div>
            </section>

            {readerMetaLine.length > 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{readerMetaLine.join(" · ")}</p>
            ) : null}
          </div>

          {item.content ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" role="tablist" aria-label={simplifyMessages.panelHeading}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "original"}
                    onClick={() => setViewMode("original")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      viewMode === "original"
                        ? "bg-sky-600 text-white"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {simplifyMessages.originalTab}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "simplified"}
                    onClick={() => void openSimplifiedView()}
                    disabled={simplifyDisabled}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      viewMode === "simplified"
                        ? "bg-sky-600 text-white"
                        : "text-slate-700 dark:text-slate-200"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {simplifyMessages.simplifiedTab}
                  </button>
                </div>
                {viewMode === "simplified" && simplifyState ? (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClassNameForSimplify(simplifyState.status)}`}>
                    {renderSimplifyBadgeLabel(simplifyMessages, simplifyState)}
                  </span>
                ) : null}
              </div>

              {viewMode === "original" ? (
                <MarkdownArticle markdown={item.content.markdown} />
              ) : (
                <SimplifiedPanel
                  messages={simplifyMessages}
                  fetchStatus={simplifyFetchStatus}
                  state={simplifyState}
                  errorCode={simplifyErrorCode}
                  busy={simplifyActionBusy}
                  onRetry={() => void openSimplifiedView()}
                  onRegenerate={() => void regenerateSimplified()}
                />
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {messages.cabinet.reader.noInAppContent}
            </div>
          )}

          {item.related_items.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {messages.cabinet.reader.relatedHeading}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {item.related_items.map((relatedItem) => (
                  <article
                    key={relatedItem.slug}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none"
                  >
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{relatedItem.title}</h3>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {relatedItem.material_type}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {relatedItem.read_url ? (
                        <Link
                          to={relatedItem.read_url}
                          className="inline-flex rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
                        >
                          {messages.cabinet.library.readMaterial}
                        </Link>
                      ) : null}
                      <a
                        href={relatedItem.open_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-900"
                      >
                        {messages.cabinet.library.openSource}
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <details className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
            <summary className="cursor-pointer list-none text-sm font-medium text-slate-700 dark:text-slate-100">
              {messages.cabinet.reader.contextToggle}
            </summary>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{messages.cabinet.reader.contextHint}</p>

            <dl className="mt-3 grid gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
              <div>
                <dt className="font-medium">{messages.cabinet.reader.fields.status}</dt>
                <dd>{getStatusLabel(messages.cabinet.reader.statuses, item.material_status)}</dd>
              </div>
              <div>
                <dt className="font-medium">{messages.cabinet.reader.fields.category}</dt>
                <dd>{item.category}</dd>
              </div>
              <div>
                <dt className="font-medium">{messages.cabinet.reader.fields.audience}</dt>
                <dd>{item.audience}</dd>
              </div>
              <div>
                <dt className="font-medium">{messages.cabinet.reader.fields.language}</dt>
                <dd>{item.language}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium">{messages.cabinet.reader.fields.source}</dt>
                <dd className="break-all font-mono text-xs text-slate-500 dark:text-slate-400">{item.source_path}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium">{messages.cabinet.reader.fields.tags}</dt>
                <dd className="flex flex-wrap gap-2">
                  {visibleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                  {remainingTagCount > 0 ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      +{remainingTagCount}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </details>
        </div>
      </SectionCard>
    </div>
  );

  async function openSimplifiedView() {
    setViewMode("simplified");
    if (!item?.content) {
      return;
    }

    if (!simplifyState) {
      await refreshSimplifiedState();
      return;
    }

    if (simplifyState.status === "ready" || simplifyState.status === "disabled") {
      return;
    }

    await ensureSimplified(false);
  }

  async function regenerateSimplified() {
    await ensureSimplified(true);
  }

  async function refreshSimplifiedState() {
    if (!item?.content) {
      return;
    }

    setSimplifyFetchStatus("loading");
    setSimplifyErrorCode(null);

    const result = await fetchSimplifyState(item.slug);
    if (result.kind === "unauthorized") {
      navigate(`/cabinet/login?next=${encodeURIComponent(`/cabinet/materials/${item.slug}`)}`, {
        replace: true
      });
      return;
    }

    if (result.kind === "error") {
      setSimplifyFetchStatus("error");
      setSimplifyErrorCode(result.error.code);
      return;
    }

    setSimplifyState(result.state);
    setSimplifyFetchStatus("ready");
    if (result.state.status === "idle" || result.state.status === "stale" || result.state.status === "failed") {
      await ensureSimplified(false);
    }
  }

  async function ensureSimplified(force: boolean) {
    if (!item?.content) {
      return;
    }

    setSimplifyActionBusy(true);
    setSimplifyFetchStatus("loading");
    setSimplifyErrorCode(null);
    try {
      const result = force ? await postRegenerate(item.slug) : await postEnsureSimplified(item.slug);
      if (result.kind === "unauthorized") {
        navigate(`/cabinet/login?next=${encodeURIComponent(`/cabinet/materials/${item.slug}`)}`, {
          replace: true
        });
        return;
      }

      if (result.kind === "error") {
        setSimplifyFetchStatus("error");
        setSimplifyErrorCode(result.error.code);
        return;
      }

      setSimplifyState(result.state);
      setSimplifyFetchStatus("ready");
    } catch {
      setSimplifyFetchStatus("error");
      setSimplifyErrorCode("internal_error");
    } finally {
      setSimplifyActionBusy(false);
    }
  }
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200 dark:shadow-none">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function getPrepCue(
  messages: { draft: string; working: string; final: string },
  status: CabinetMaterialStatus
) {
  if (status === "final") {
    return messages.final;
  }
  if (status === "working") {
    return messages.working;
  }
  return messages.draft;
}

async function readApiError(response: Response): Promise<ApiError> {
  try {
    return (await response.json()) as ApiError;
  } catch {
    return {
      code: "internal_error",
      message: "Request failed."
    };
  }
}

function getStatusLabel(
  messages: { draft: string; working: string; final: string },
  status: CabinetMaterialStatus
) {
  if (status === "final") {
    return messages.final;
  }
  if (status === "working") {
    return messages.working;
  }
  return messages.draft;
}

function statusBadgeClassName(status: CabinetMaterialStatus) {
  if (status === "final") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  }
  if (status === "working") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }
  return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
}

function statusBadgeClassNameForSimplify(status: CabinetMaterialSimplifyState["status"]) {
  if (status === "ready") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  }
  if (status === "stale") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }
  if (status === "failed" || status === "disabled") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200";
  }
  if (status === "generating") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  }
  return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
}

function renderSimplifyBadgeLabel(
  messages: AppMessages["cabinet"]["reader"]["simplify"],
  state: CabinetMaterialSimplifyState
) {
  if (state.status === "ready") {
    return state.delivery_mode === "generated" ? messages.generatedNow : messages.fromCache;
  }
  if (state.status === "stale") {
    return messages.staleBadge;
  }
  if (state.status === "failed") {
    return messages.failedBadge;
  }
  if (state.status === "disabled") {
    return messages.disabledBadge;
  }
  if (state.status === "generating") {
    return messages.generating;
  }
  return messages.simplifiedTab;
}

function MarkdownArticle({ markdown }: { markdown: string }) {
  return (
    <article className={ARTICLE_CLASS_NAME}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a(props) {
            const href = typeof props.href === "string" ? props.href : "";
            const isExternal = /^https?:\/\//i.test(href) || href.startsWith("/api/");
            return <a {...props} href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined} />;
          }
        }}
      >
        {markdown}
      </Markdown>
    </article>
  );
}

function SimplifiedPanel({
  messages,
  fetchStatus,
  state,
  errorCode,
  busy,
  onRetry,
  onRegenerate
}: {
  messages: AppMessages["cabinet"]["reader"]["simplify"];
  fetchStatus: SimplifyFetchStatus;
  state: CabinetMaterialSimplifyState | null;
  errorCode: ApiError["code"] | null;
  busy: boolean;
  onRetry: () => void;
  onRegenerate: () => void;
}) {
  if (fetchStatus === "loading" && !state) {
    return <StatusPanel>{messages.loading}</StatusPanel>;
  }

  if (fetchStatus === "error") {
    return (
      <StatusPanel>
        <div className="space-y-3">
          <p>
            {messages.failed}
            {errorCode ? ` (${errorCode})` : ""}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
          >
            {messages.retry}
          </button>
        </div>
      </StatusPanel>
    );
  }

  if (!state || state.status === "idle") {
    return <StatusPanel>{messages.idle}</StatusPanel>;
  }

  if (state.status === "disabled") {
    return <StatusPanel>{state.disabled_reason === "key_missing" ? messages.disabledMissingKey : messages.disabled}</StatusPanel>;
  }

  if (state.status === "generating") {
    return <StatusPanel>{messages.loadingState}</StatusPanel>;
  }

  if (state.status === "failed") {
    return (
      <StatusPanel>
        <div className="space-y-3">
          <p>{state.error_message ?? messages.failed}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100"
          >
            {busy ? messages.loadingState : messages.retry}
          </button>
        </div>
      </StatusPanel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
        <p className="font-medium text-slate-900 dark:text-slate-100">{messages.panelHeading}</p>
        <p className="mt-2">
          {state.status === "stale" ? messages.stale : state.delivery_mode === "generated" ? messages.generatedNow : messages.fromCache}
        </p>
        {state.generated_at ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{messages.generatedAt.replace("{value}", formatShortDate(state.generated_at))}</p> : null}
        {state.error_code === "output_truncated" ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">{messages.truncatedWarning}</p>
            <p className="mt-1">{messages.truncatedHint}</p>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{messages.disclaimer}</p>
      </div>

      {state.content ? <MarkdownArticle markdown={state.content} /> : <StatusPanel>{messages.unavailable}</StatusPanel>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-900"
        >
          {busy ? messages.regenerating : state.status === "stale" ? messages.refreshStale : messages.regenerate}
        </button>
      </div>
    </div>
  );
}

function StatusPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
      {children}
    </div>
  );
}

async function fetchSimplifyState(
  slug: string
): Promise<
  | { kind: "ok"; state: CabinetMaterialSimplifyState }
  | { kind: "unauthorized" }
  | { kind: "error"; error: ApiError }
> {
  const response = await fetch(`/api/cabinet/materials/${slug}/simplify`, {
    credentials: "include"
  });

  if (response.status === 401) {
    return { kind: "unauthorized" };
  }

  if (!response.ok) {
    return {
      kind: "error",
      error: await readApiError(response)
    };
  }

  const payload = (await response.json()) as CabinetMaterialSimplifyResponse;
  return {
    kind: "ok",
    state: payload.state
  };
}

async function postEnsureSimplified(
  slug: string
): Promise<
  | { kind: "ok"; state: CabinetMaterialSimplifyState }
  | { kind: "unauthorized" }
  | { kind: "error"; error: ApiError }
> {
  const response = await fetch(`/api/cabinet/materials/${slug}/simplify`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });

  if (response.status === 401) {
    return { kind: "unauthorized" };
  }

  if (!response.ok) {
    return {
      kind: "error",
      error: await readApiError(response)
    };
  }

  const payload = (await response.json()) as CabinetMaterialSimplifyResponse;
  return {
    kind: "ok",
    state: payload.state
  };
}

async function postRegenerate(
  slug: string
): Promise<
  | { kind: "ok"; state: CabinetMaterialSimplifyState }
  | { kind: "unauthorized" }
  | { kind: "error"; error: ApiError }
> {
  const response = await fetch(`/api/cabinet/materials/${slug}/simplify/regenerate`, {
    method: "POST",
    credentials: "include"
  });

  if (response.status === 401) {
    return { kind: "unauthorized" };
  }

  if (!response.ok) {
    return {
      kind: "error",
      error: await readApiError(response)
    };
  }

  const payload = (await response.json()) as CabinetMaterialSimplifyResponse;
  return {
    kind: "ok",
    state: payload.state
  };
}

function formatShortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

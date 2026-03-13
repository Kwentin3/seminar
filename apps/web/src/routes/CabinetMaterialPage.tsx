import type { ApiError, CabinetMaterialDetailResponse, CabinetMaterialStatus } from "@seminar/contracts";
import { SectionCard } from "@seminar/ui";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Link, useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { useAppContext } from "../app/useAppContext";

type ReaderStatus = "loading" | "ready" | "error" | "not-found";

export function CabinetMaterialPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { messages } = useAppContext();

  const [status, setStatus] = useState<ReaderStatus>("loading");
  const [item, setItem] = useState<CabinetMaterialDetailResponse["item"] | null>(null);
  const [errorCode, setErrorCode] = useState<ApiError["code"] | null>(null);

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

  return (
    <div className="space-y-6">
      <SectionCard title={item.title} description={item.summary ?? messages.cabinet.library.description}>
        <div className="space-y-5">
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

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/cabinet"
              className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-900"
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

          <dl className="grid gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200 md:grid-cols-2">
            <div>
              <dt className="font-medium">{messages.cabinet.reader.fields.status}</dt>
              <dd>{getStatusLabel(messages.cabinet.reader.statuses, item.material_status)}</dd>
            </div>
            <div>
              <dt className="font-medium">{messages.cabinet.reader.fields.type}</dt>
              <dd>{item.material_type}</dd>
            </div>
            <div>
              <dt className="font-medium">{messages.cabinet.reader.fields.category}</dt>
              <dd>{item.category}</dd>
            </div>
            <div>
              <dt className="font-medium">{messages.cabinet.reader.fields.theme}</dt>
              <dd>{item.theme ?? item.category}</dd>
            </div>
            <div>
              <dt className="font-medium">{messages.cabinet.reader.fields.audience}</dt>
              <dd>{item.audience}</dd>
            </div>
            <div>
              <dt className="font-medium">{messages.cabinet.reader.fields.language}</dt>
              <dd>{item.language}</dd>
            </div>
            <div>
              <dt className="font-medium">{messages.cabinet.reader.fields.updated}</dt>
              <dd>{item.source_updated_at ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium">{messages.cabinet.reader.fields.curated}</dt>
              <dd>{item.curation_reviewed_at ?? "-"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-medium">{messages.cabinet.reader.fields.source}</dt>
              <dd className="break-all font-mono text-xs">{item.source_path}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-medium">{messages.cabinet.reader.fields.tags}</dt>
              <dd className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          </dl>

          {item.content ? (
            <article
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 [&_a]:text-sky-700 [&_a]:underline [&_a]:underline-offset-4 dark:[&_a]:text-sky-300 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic dark:[&_blockquote]:border-slate-700 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.95em] dark:[&_code]:bg-slate-800 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:first:mt-0 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_hr]:my-8 [&_hr]:border-slate-200 dark:[&_hr]:border-slate-700 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 dark:[&_img]:border-slate-700 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_tbody_tr:nth-child(odd)]:bg-slate-50 dark:[&_tbody_tr:nth-child(odd)]:bg-slate-800/60 [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-slate-700 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-800 [&_ul]:list-disc [&_ul]:pl-6"
            >
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a(props) {
                    const href = typeof props.href === "string" ? props.href : "";
                    const isExternal = /^https?:\/\//i.test(href) || href.startsWith("/api/");
                    return (
                      <a
                        {...props}
                        href={href}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noreferrer" : undefined}
                      />
                    );
                  }
                }}
              >
                {item.content.markdown}
              </Markdown>
            </article>
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
                    className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
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
        </div>
      </SectionCard>
    </div>
  );
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

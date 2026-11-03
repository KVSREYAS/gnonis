"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readCourseRecord, type CourseDownloadRecord } from "@/lib/offline/db";
import { downloadCourse, removeCourseDownload, type DownloadProgress } from "@/lib/offline/download";
import { formatBytes } from "@/lib/offline/catalog";
import { useOnline } from "@/lib/offline/use-online";
import type { CourseSummary } from "@/lib/content/types";

function useCourseRecord(slug: string) {
  const [record, setRecord] = useState<CourseDownloadRecord | null>(null);
  const [ready, setReady] = useState(false);
  const reload = useCallback(() => {
    readCourseRecord(slug)
      .then(setRecord)
      .catch(() => setRecord(null))
      .finally(() => setReady(true));
  }, [slug]);

  useEffect(() => {
    let alive = true;
    readCourseRecord(slug)
      .then((row) => {
        if (alive) setRecord(row);
      })
      .catch(() => {
        if (alive) setRecord(null);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    const onChange = () => reload();
    window.addEventListener("gnosis-offline", onChange);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("gnosis-offline");
      channel.onmessage = onChange;
    } catch {
      channel = null;
    }
    return () => {
      alive = false;
      window.removeEventListener("gnosis-offline", onChange);
      channel?.close();
    };
  }, [reload, slug]);

  return { record, ready };
}

function downloadError(error: unknown): string {
  if (error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
    return "This device doesn't have enough free space for that course.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "The download stopped. Check your connection and try again.";
}

export function CourseDownload({ course, detailed = false }: { course: CourseSummary; detailed?: boolean }) {
  const online = useOnline();
  const { record, ready } = useCourseRecord(course.slug);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "remove" | null>(null);

  async function start() {
    setError(null);
    setBusy("download");
    setProgress({ completed: 0, total: 1, bytes: 0 });
    try {
      await downloadCourse(course, setProgress);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(downloadError(caught));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function remove() {
    setError(null);
    setBusy("remove");
    try {
      await removeCourseDownload(course.slug);
    } catch (caught) {
      setError(downloadError(caught));
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <div className="h-11" data-testid={`offline-course-${course.slug}`} />;

  const percent = progress && progress.total > 0 ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0;

  return (
    <div className="mt-3" data-testid={`offline-course-${course.slug}`}>
      {busy === "download" && progress ? (
        <div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-panel-2"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Download progress"
            data-testid={`offline-progress-${course.slug}`}
          >
            <div className="h-full bg-gold" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground" role="status">
            Saving {progress.completed} of {progress.total}
            {progress.bytes > 0 ? ` · ${formatBytes(progress.bytes)}` : ""}
          </p>
        </div>
      ) : record ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-gold-ink" data-testid={`offline-ready-${course.slug}`}>
            Downloaded · {formatBytes(record.bytes)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void remove()}
            disabled={busy === "remove"}
            data-testid={`offline-remove-${course.slug}`}
          >
            <Trash2 aria-hidden />
            {busy === "remove" ? "Removing…" : "Remove download"}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void start()}
          disabled={!online}
          data-testid={`offline-download-${course.slug}`}
        >
          <Download aria-hidden />
          Download for offline
        </Button>
      )}
      {!record && !online && busy !== "download" && <p className="mt-1 text-sm text-muted-foreground">Connect once to save this course on the device.</p>}
      {error && (
        <p className="mt-1 text-sm text-foreground" role="alert" data-testid={`offline-error-${course.slug}`}>
          {error}
        </p>
      )}
      {detailed && (
        <p className="mt-2 text-sm text-muted-foreground">
          On iPhone, open the Share sheet and tap Add to Home Screen. Gnosis then opens like an app, including with no signal, for courses you downloaded.
        </p>
      )}
    </div>
  );
}

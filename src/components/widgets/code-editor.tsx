"use client";

import { useEffect, useRef } from "react";
import type { EditorLanguage } from "./code-mirror";

export function CodeEditor({
  value,
  onChange,
  disabled,
  label,
  language = "python",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  language?: EditorLanguage;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const disabledRef = useRef(Boolean(disabled));
  const api = useRef<{ setValue: (value: string) => void; setReadOnly: (readOnly: boolean) => void } | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let dead = false;
    let destroy = () => {};
    void import("./code-mirror").then(({ mountCodeMirror }) => {
      if (dead || !parent.isConnected) return;
      const mounted = mountCodeMirror({
        parent,
        value: valueRef.current,
        language,
        readOnly: disabledRef.current,
        label,
        onChange: (next) => onChangeRef.current(next),
      });
      api.current = mounted;
      destroy = () => mounted.destroy();
    });
    return () => {
      dead = true;
      api.current = null;
      destroy();
    };
  }, [language, label]);

  useEffect(() => {
    valueRef.current = value;
    api.current?.setValue(value);
  }, [value]);

  useEffect(() => {
    disabledRef.current = Boolean(disabled);
    api.current?.setReadOnly(Boolean(disabled));
  }, [disabled]);

  return (
    <div className="overflow-hidden rounded-lg border-2 border-border bg-ink focus-within:border-gold">
      <div ref={host} className="min-h-48" />
    </div>
  );
}

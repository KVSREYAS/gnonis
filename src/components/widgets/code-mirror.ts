"use client";

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completeAnyWord,
  completeFromList,
  completionKeymap,
  ifNotIn,
  snippetCompletion,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { cpp, cppLanguage } from "@codemirror/lang-cpp";
import { python, pythonLanguage } from "@codemirror/lang-python";
import { bracketMatching, foldGutter, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

export type EditorLanguage = "python" | "cpp";

const CPP_KEYWORDS = [
  "alignas", "alignof", "auto", "bool", "break", "case", "catch", "char", "class", "co_return", "concept",
  "const", "consteval", "constexpr", "constinit", "continue", "decltype", "default", "delete", "do", "double",
  "else", "enum", "explicit", "extern", "false", "float", "for", "friend", "if", "inline", "int", "long",
  "mutable", "namespace", "new", "noexcept", "nullptr", "operator", "private", "protected", "public", "requires",
  "return", "short", "signed", "sizeof", "static", "static_cast", "struct", "switch", "template", "this",
  "throw", "true", "try", "typedef", "typename", "union", "unsigned", "using", "virtual", "void", "volatile",
  "while", "string", "vector", "cout", "cin", "endl", "std",
];

const cppCompletions = [
  ...CPP_KEYWORDS.map((label) => ({ label, type: "keyword" as const })),
  snippetCompletion("int main() {\n  ${}\n}\n", { label: "main", detail: "function", type: "keyword" }),
  snippetCompletion("for (int ${i} = 0; ${i} < ${n}; ++${i}) {\n  ${}\n}", { label: "for", detail: "loop", type: "keyword" }),
  snippetCompletion("if (${cond}) {\n  ${}\n}", { label: "if", detail: "branch", type: "keyword" }),
  snippetCompletion("while (${cond}) {\n  ${}\n}", { label: "while", detail: "loop", type: "keyword" }),
  snippetCompletion("#include <${header}>", { label: "include", detail: "header", type: "keyword" }),
  snippetCompletion("std::cout << ${value} << '\\n';", { label: "cout", detail: "print", type: "function" }),
  snippetCompletion("std::cin >> ${name};", { label: "cin", detail: "read", type: "function" }),
];

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--gold-ink)" },
  { tag: tags.comment, color: "var(--text-muted)", fontStyle: "italic" },
  { tag: tags.string, color: "var(--money-ink)" },
  { tag: tags.number, color: "#7eb6ff" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#f0a070" },
  { tag: tags.definition(tags.variableName), color: "#9cdcfe" },
  { tag: tags.typeName, color: "#d2a8ff" },
  { tag: [tags.variableName, tags.propertyName, tags.operator, tags.punctuation], color: "var(--text)" },
]);

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--text)", fontSize: "16px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-code), ui-monospace, monospace", lineHeight: "1.5", overflow: "auto" },
  ".cm-content": { padding: "12px 0", minHeight: "12rem", caretColor: "var(--caret)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--caret)", borderLeftWidth: "2px", marginLeft: "-1px" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--text-muted)", borderRight: "1px solid var(--line)" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--editor-active-line)" },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-tooltip": {
    zIndex: "40",
    border: "1px solid var(--line)",
    backgroundColor: "var(--panel)",
    color: "var(--text)",
    maxWidth: "min(24rem, calc(100vw - 2rem))",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-code), ui-monospace, monospace", maxHeight: "11rem" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "var(--panel-2)", color: "var(--text)" },
  ".cm-completionMatchedText": { textDecoration: "none", color: "var(--gold-ink)", fontWeight: "700" },
});

function languageExtensions(language: EditorLanguage): Extension {
  if (language === "cpp") {
    return [
      cpp(),
      cppLanguage.data.of({
        autocomplete: ifNotIn(
          ["LineComment", "BlockComment", "String", "RawString", "CharLiteral", "SystemLibString"],
          completeFromList(cppCompletions),
        ),
      }),
      cppLanguage.data.of({
        autocomplete: ifNotIn(
          ["LineComment", "BlockComment", "String", "RawString", "CharLiteral", "SystemLibString"],
          completeAnyWord,
        ),
      }),
      indentUnit.of("  "),
      EditorState.tabSize.of(2),
    ];
  }
  return [
    python(),
    pythonLanguage.data.of({ autocomplete: ifNotIn(["Comment", "String", "FormatString"], completeAnyWord) }),
    indentUnit.of("    "),
    EditorState.tabSize.of(4),
  ];
}

export function mountCodeMirror(options: {
  parent: HTMLElement;
  value: string;
  language: EditorLanguage;
  readOnly: boolean;
  label: string;
  onChange: (value: string) => void;
}): { destroy: () => void; setValue: (value: string) => void; setReadOnly: (readOnly: boolean) => void } {
  let applying = false;
  const readOnly = new Compartment();
  const appearance = new Compartment();
  const darkNow = () => document.documentElement.dataset.theme !== "light";
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ activateOnTyping: true, maxRenderedOptions: 8, defaultKeymap: true }),
        highlightActiveLine(),
        keymap.of([...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        syntaxHighlighting(highlight),
        EditorView.lineWrapping,
        theme,
        appearance.of(EditorView.darkTheme.of(darkNow())),
        EditorView.contentAttributes.of({
          "aria-label": options.label,
          "data-testid": "code-editor",
          autocapitalize: "off",
          autocorrect: "off",
          spellcheck: "false",
        }),
        languageExtensions(options.language),
        readOnly.of(EditorState.readOnly.of(options.readOnly)),
        EditorView.updateListener.of((update) => {
          if (applying || !update.docChanged) return;
          options.onChange(update.state.doc.toString());
        }),
      ],
    }),
  });

  const appearanceObserver = new MutationObserver(() => {
    view.dispatch({ effects: appearance.reconfigure(EditorView.darkTheme.of(darkNow())) });
  });
  appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return {
    destroy: () => {
      appearanceObserver.disconnect();
      view.destroy();
    },
    setValue: (value) => {
      const current = view.state.doc.toString();
      if (current === value) return;
      applying = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        selection: EditorSelection.cursor(value.length),
      });
      applying = false;
    },
    setReadOnly: (value) => {
      view.dispatch({ effects: readOnly.reconfigure(EditorState.readOnly.of(value)) });
    },
  };
}

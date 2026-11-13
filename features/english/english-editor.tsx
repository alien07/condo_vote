"use client";

import { useState, useTransition } from "react";
import { translateTexts } from "@/features/english/actions";
import type { EnglishMeeting } from "@/features/english/data";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

type Field = { key: string; label: string; thai: string };

const box =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm";

/** Thai beside English, a Translate button per line, and "Translate all"
 * (demo feedback item 6b). Saving goes through saveMeetingEnglish. */
export function EnglishEditor({
  meeting,
  t,
  action,
  checkedLabel,
}: {
  meeting: EnglishMeeting;
  t: StaffDictionary["english"];
  action: (formData: FormData) => void | Promise<void>;
  checkedLabel: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {
      "meeting.title_en": meeting.title_en ?? "",
      "meeting.location_en": meeting.location_en ?? "",
    };

    for (const question of meeting.questions) {
      initial[`q.${question.id}.agenda_title_en`] = question.agenda_title_en ?? "";
      initial[`q.${question.id}.question_text_en`] = question.question_text_en ?? "";
      initial[`q.${question.id}.legal_note_en`] = question.legal_note_en ?? "";

      for (const choice of question.choices) {
        initial[`c.${choice.id}`] = choice.choice_text_en ?? "";
      }
    }

    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const fields: Field[] = [
    { key: "meeting.title_en", label: t.titleField, thai: meeting.title },
    ...(meeting.location ? [{ key: "meeting.location_en", label: t.locationField, thai: meeting.location }] : []),
    ...meeting.questions.flatMap((question) => {
      const agenda = question.agenda_no ? `${fill(t.agenda, { no: question.agenda_no })} · ` : "";

      return [
        ...(question.agenda_title
          ? [{ key: `q.${question.id}.agenda_title_en`, label: `${agenda}${t.agendaTitle}`, thai: question.agenda_title }]
          : []),
        { key: `q.${question.id}.question_text_en`, label: `${agenda}${t.question}`, thai: question.question_text },
        ...(question.legal_note
          ? [{ key: `q.${question.id}.legal_note_en`, label: `${agenda}${t.legalNote}`, thai: question.legal_note }]
          : []),
        ...question.choices
          .filter((choice) => !choice.is_abstain)
          .map((choice) => ({ key: `c.${choice.id}`, label: `${agenda}${t.choice}`, thai: choice.choice_text })),
      ];
    }),
  ];

  function translate(keys: string[]) {
    const targets = fields.filter((field) => keys.includes(field.key));

    if (targets.length === 0) {
      return;
    }

    setBusy(keys.length === 1 ? keys[0] : "all");
    setError(null);
    startTransition(async () => {
      const result = await translateTexts(targets.map((field) => field.thai));

      if (result.ok) {
        setValues((current) => {
          const next = { ...current };
          targets.forEach((field, index) => {
            next[field.key] = result.texts[index] ?? "";
          });
          return next;
        });
      } else {
        setError(result.error);
      }

      setBusy(null);
    });
  }

  const payload = {
    meeting: { title_en: values["meeting.title_en"], location_en: values["meeting.location_en"] },
    questions: meeting.questions.map((question) => ({
      id: question.id,
      agenda_title_en: values[`q.${question.id}.agenda_title_en`],
      question_text_en: values[`q.${question.id}.question_text_en`],
      legal_note_en: values[`q.${question.id}.legal_note_en`],
    })),
    choices: meeting.questions.flatMap((question) =>
      question.choices
        .filter((choice) => !choice.is_abstain)
        .map((choice) => ({ id: choice.id, choice_text_en: values[`c.${choice.id}`] })),
    ),
  };
  const empty = fields.filter((field) => !values[field.key]?.trim()).map((field) => field.key);

  return (
    <form action={action} className="grid gap-4">
      <input name="meeting_id" type="hidden" value={meeting.id} />
      <input name="text_json" type="hidden" value={JSON.stringify(payload)} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={busy !== null || empty.length === 0}
          onClick={() => translate(empty)}
          type="button"
        >
          {busy === "all" ? t.translating : t.translateAll}
        </button>
        {error ? (
          <p className="text-sm font-medium text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        {fields.map((field) => (
          <div
            className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 md:grid-cols-[1fr_1fr_auto] md:items-start"
            data-english-field={field.key}
            key={field.key}
          >
            <div className="text-sm">
              <div className="text-xs font-medium text-[var(--muted)]">
                {field.label} · {t.thai}
              </div>
              <div lang="th">{field.thai}</div>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">
                {field.label} · {t.english}
              </span>
              <textarea
                className={box}
                lang="en"
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((current) => ({ ...current, [field.key]: value }));
                }}
                rows={field.thai.length > 60 ? 3 : 1}
                value={values[field.key] ?? ""}
              />
            </label>
            <button
              className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => translate([field.key])}
              type="button"
            >
              {busy === field.key ? t.translating : t.translate}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--muted)]">{t.noDemo}</p>

      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
        <input name="checked" type="checkbox" />
        {t.checked}
        <span className="font-normal text-[var(--muted)]">({checkedLabel})</span>
      </label>

      <button
        className="min-h-11 w-fit rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
        type="submit"
      >
        {t.save}
      </button>
    </form>
  );
}

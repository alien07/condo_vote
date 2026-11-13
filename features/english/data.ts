import { createClient } from "@/lib/supabase/server";

export type EnglishMeeting = {
  id: string;
  status: string;
  title: string;
  title_en: string | null;
  location: string | null;
  location_en: string | null;
  english_checked_at: string | null;
  questions: Array<{
    id: string;
    agenda_no: string | null;
    agenda_title: string | null;
    agenda_title_en: string | null;
    question_text: string;
    question_text_en: string | null;
    legal_note: string | null;
    legal_note_en: string | null;
    choices: Array<{ id: string; choice_text: string; choice_text_en: string | null; is_abstain: boolean }>;
  }>;
};

/** One meeting's Thai and English text, for the English editor. */
export async function getEnglishMeeting(meetingId: string): Promise<EnglishMeeting | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select(
      "id, status, title, title_en, location, location_en, english_checked_at, meeting_questions(id, agenda_no, agenda_title, agenda_title_en, question_text, question_text_en, legal_note, legal_note_en, display_order, meeting_choices(id, choice_text, choice_text_en, is_abstain, display_order))",
    )
    .eq("id", meetingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    status: data.status,
    title: data.title,
    title_en: data.title_en,
    location: data.location,
    location_en: data.location_en,
    english_checked_at: data.english_checked_at,
    questions: [...(data.meeting_questions ?? [])]
      .sort((a, b) => a.display_order - b.display_order)
      .map((question) => ({
        id: question.id,
        agenda_no: question.agenda_no,
        agenda_title: question.agenda_title,
        agenda_title_en: question.agenda_title_en,
        question_text: question.question_text,
        question_text_en: question.question_text_en,
        legal_note: question.legal_note,
        legal_note_en: question.legal_note_en,
        choices: [...(question.meeting_choices ?? [])]
          .sort((a, b) => a.display_order - b.display_order)
          .map((choice) => ({
            id: choice.id,
            choice_text: choice.choice_text,
            choice_text_en: choice.choice_text_en,
            is_abstain: choice.is_abstain,
          })),
      })),
  };
}

/** What is missing before a meeting can be published in two languages. */
export function englishGaps(meeting: EnglishMeeting) {
  const missing =
    !meeting.title_en ||
    (Boolean(meeting.location) && !meeting.location_en) ||
    meeting.questions.some(
      (question) =>
        !question.question_text_en ||
        (Boolean(question.agenda_title) && !question.agenda_title_en) ||
        (Boolean(question.legal_note) && !question.legal_note_en) ||
        // Abstain has its own wording in both languages.
        question.choices.some((choice) => !choice.is_abstain && !choice.choice_text_en),
    );

  return { missing, unchecked: !meeting.english_checked_at };
}

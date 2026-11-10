import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PrintButton } from "@/features/results/print-button";
import {
  THAI_MEETING_ROUNDS,
  THAI_MEETING_TYPES,
  THAI_RESOLUTION_TYPES,
  THAI_SIGNATORIES,
  thaiBallotSecrecy,
  thaiOutcome,
  thaiPassRule,
  thaiQuorum,
} from "@/features/results/thai-labels";
import type { SummaryPayload } from "@/features/summary/data";
import { requireProfileWithRoles } from "@/lib/auth/permissions";
import { formatThaiDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

type RecordPageProps = {
  params: Promise<{ snapshotId: string }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pct(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="align-top">
      <th className="w-56 py-1 pr-4 text-left font-medium">{label}</th>
      <td className="py-1">{children}</td>
    </tr>
  );
}

function cssString(value: string) {
  return value.replace(/["\\\n]/g, " ");
}

// Official result record (document 1). Admins see every snapshot; committee
// members see published ones (RLS). Printed from the browser as A4.
export default async function OfficialRecordPage({ params }: RecordPageProps) {
  const { roles } = await requireProfileWithRoles();

  if (!roles.includes("admin") && !roles.includes("committee")) {
    redirect("/summary");
  }

  const { snapshotId } = await params;
  const supabase = await createClient();
  const [snapshotResult, publicationResult, approvalsResult, settingsResult] = await Promise.all([
    supabase
      .from("result_snapshots")
      .select("id, meeting_id, generated_at, payload_json, payload_sha256")
      .eq("id", snapshotId)
      .maybeSingle(),
    supabase
      .from("result_publications")
      .select("published_at, approvals_count")
      .eq("result_snapshot_id", snapshotId)
      .maybeSingle(),
    supabase
      .from("committee_approvals")
      .select("approved_at, notes, profiles!committee_approvals_approved_by_fkey(full_name)")
      .eq("result_snapshot_id", snapshotId)
      .order("approved_at", { ascending: true }),
    supabase
      .from("condo_profiles")
      .select("record_signatories, result_notice_days, document_footer")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (snapshotResult.error) {
    throw snapshotResult.error;
  }

  const snapshot = snapshotResult.data;

  if (!snapshot) {
    notFound();
  }

  const payload = (snapshot.payload_json ?? {}) as SummaryPayload;
  const meeting = payload.meeting ?? {};
  const condo = payload.condo ?? null;
  const totals = payload.totals ?? {};
  const publication = publicationResult.data;
  const approvals = approvalsResult.data ?? [];
  const settings = settingsResult.data?.[0] ?? null;
  const signatories = settings?.record_signatories?.length
    ? settings.record_signatories
    : ["chairperson", "manager"];
  const noticeDays =
    meeting.notice_sent_at && meeting.starts_at
      ? Math.floor((Date.parse(meeting.starts_at) - Date.parse(meeting.notice_sent_at)) / DAY_MS)
      : null;
  const conflicts = payload.vote_source_audit?.conflicts ?? [];
  const incidents = payload.incidents ?? [];
  const hash = snapshot.payload_sha256 ?? "-";
  const footer = cssString(`เลขอ้างอิง ${snapshot.id} · SHA-256 ${hash}`);

  return (
    <main className="record-document mx-auto max-w-4xl px-6 py-8 text-sm leading-6 print:max-w-none print:p-0">
      <style>{`
        @page {
          size: A4;
          margin: 18mm 16mm 22mm;
          @bottom-left { content: "${footer}"; font-size: 7pt; color: #555; }
          @bottom-right { content: "หน้า " counter(page) " / " counter(pages); font-size: 8pt; }
        }
        @media print {
          body { background: #fff; }
          .record-document table { break-inside: auto; }
          .record-document tr, .record-document section { break-inside: avoid; }
        }
      `}</style>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-[var(--muted)]">
          Official result record (Thai). Print it, or choose Save as PDF in the print dialog.
        </p>
        <PrintButton />
      </div>

      {!publication ? (
        <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 font-medium text-amber-900">
          ร่าง: ผลนี้ยังไม่ได้รับการอนุมัติครบตามจำนวนที่กำหนด
        </p>
      ) : null}

      <header className="border-b border-black/20 pb-4 text-center">
        <h1 className="text-xl font-bold">บันทึกผลการลงมติ</h1>
        <p className="mt-1 text-base font-semibold">
          {condo?.juristic_name ?? "นิติบุคคลอาคารชุด"}
        </p>
        <p>
          {condo?.project_name ?? ""}
          {condo?.registration_no ? ` · ทะเบียนเลขที่ ${condo.registration_no}` : ""}
        </p>
        {condo?.address ? <p>{condo.address}</p> : null}
      </header>

      <section className="mt-5">
        <h2 className="text-base font-bold">1. ข้อมูลการประชุม</h2>
        <table className="mt-2 w-full">
          <tbody>
            <Row label="ชื่อการประชุม">{meeting.title ?? "-"}</Row>
            <Row label="ประเภท">
              {THAI_MEETING_TYPES[meeting.meeting_type ?? ""] ?? meeting.meeting_type ?? "-"}
              {meeting.meeting_number ? ` ครั้งที่ ${meeting.meeting_number}` : ""}
              {meeting.fiscal_year ? ` ปีบัญชี ${meeting.fiscal_year}` : ""}
            </Row>
            <Row label="ครั้งของการประชุม (ม.43)">
              {THAI_MEETING_ROUNDS[meeting.meeting_round ?? "first"] ?? "-"}
            </Row>
            <Row label="วันส่งหนังสือเชิญประชุม (ม.42/3)">
              {meeting.notice_sent_at ? (
                <>
                  {formatThaiDateTime(meeting.notice_sent_at)}
                  {noticeDays !== null ? ` (ก่อนวันประชุม ${noticeDays} วัน${noticeDays < 7 ? " — น้อยกว่า 7 วัน" : ""})` : ""}
                </>
              ) : (
                "ไม่ได้บันทึก"
              )}
            </Row>
            <Row label="ลงคะแนนล่วงหน้า">
              {meeting.advance_starts_at
                ? `${formatThaiDateTime(meeting.advance_starts_at)} ถึง ${formatThaiDateTime(meeting.advance_ends_at)}`
                : "ไม่มี"}
            </Row>
            <Row label="ลงคะแนนวันประชุม">
              {formatThaiDateTime(meeting.starts_at)} ถึง {formatThaiDateTime(meeting.ends_at)}
            </Row>
            <Row label="สถานที่/ช่องทาง">{meeting.location ?? "-"}</Row>
            <Row label="ประธานที่ประชุม">{meeting.chairperson_name ?? "-"}</Row>
            <Row label="วิธีลงคะแนน">{thaiBallotSecrecy(meeting.ballot_secrecy)}</Row>
          </tbody>
        </table>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-bold">2. ผู้มีสิทธิ์และองค์ประชุม (ม.43, ม.45, ม.47)</h2>
        <table className="mt-2 w-full">
          <tbody>
            <Row label="ห้องที่มีสิทธิ์ลงคะแนน">
              {totals.eligible_voters ?? 0} ห้อง · คะแนนเสียงรวม {pct(totals.total_eligible_ownership)}
            </Row>
            <Row label="ห้องที่ลงคะแนน">
              {totals.submitted_ballots ?? 0} ห้อง · คะแนนเสียง {pct(totals.submitted_ownership)}
            </Row>
            <Row label="ลงคะแนนผ่านผู้รับมอบฉันทะ">
              {totals.proxy_rooms !== undefined ? `${totals.proxy_rooms} ห้อง` : "ไม่ได้บันทึก"}
            </Row>
            <Row label="องค์ประชุม">{thaiQuorum(totals.quorum)}</Row>
          </tbody>
        </table>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-bold">3. วิธีการแสดงตนและการลงคะแนน</h2>
        <table className="mt-2 w-full">
          <tbody>
            <Row label="การแสดงตน">{meeting.identity_method ?? "ไม่ได้บันทึก"}</Row>
            <Row label="บัตรออนไลน์ที่นับ">
              {totals.advance_online_ballots !== undefined
                ? `ลงล่วงหน้า ${totals.advance_online_ballots} ใบ · วันประชุม ${totals.meeting_day_online_ballots ?? 0} ใบ`
                : `${totals.online_ballots ?? 0} ใบ`}
            </Row>
            <Row label="บัตรกระดาษ/บันทึกโดยผู้ดูแล">
              {totals.effective_manual_ballots ?? totals.manual_ballots ?? 0} ใบ
            </Row>
            <Row label="ห้องที่มีทั้งสองช่องทาง">
              {totals.source_conflicts ?? 0} ห้อง (เลือกแหล่งแล้ว {totals.resolved_source_conflicts ?? 0})
            </Row>
            <Row label="บันทึกเสียง/ภาพการประชุม">{meeting.recording_reference ?? "ไม่ได้บันทึก"}</Row>
            <Row label="ข้อมูลจราจรอิเล็กทรอนิกส์ (log)">
              {meeting.traffic_log_reference ?? "ไม่ได้บันทึก"}
            </Row>
          </tbody>
        </table>
        {conflicts.length > 0 ? (
          <ol className="mt-2 list-decimal pl-6">
            {conflicts.map((conflict, index) => (
              <li key={index}>
                ใช้บัตร{conflict.chosen_source === "online" ? "ออนไลน์" : "กระดาษ"}
                {conflict.conflict_remark ? ` — ${conflict.conflict_remark}` : ""}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section className="mt-5">
        <h2 className="text-base font-bold">4. ผลการลงมติรายวาระ</h2>
        {(payload.questions ?? []).length === 0 ? <p className="mt-2">ไม่มีวาระ</p> : null}
        {(payload.questions ?? []).map((question, index) => {
          const decided = (question.choices ?? [])
            .filter((choice) => choice.id && question.passed_choice_ids?.includes(choice.id))
            .map((choice) => choice.text ?? "-");

          return (
            <div className="mt-3 border-t border-black/10 pt-3" key={index}>
              <h3 className="font-semibold">
                วาระที่ {question.agenda_no ?? index + 1}
                {question.agenda_title ? ` ${question.agenda_title}` : ""}
              </h3>
              <p>{question.text}</p>
              <p className="mt-1">
                เกณฑ์: {thaiPassRule(question.pass_rule)}
                {question.resolution_type ? ` · ประเภทมติ: ${THAI_RESOLUTION_TYPES[question.resolution_type] ?? question.resolution_type}` : ""}
                {question.legal_note ? ` · ${question.legal_note}` : ""}
              </p>
              <table className="mt-2 w-full border-collapse">
                <thead>
                  <tr className="border-b border-black/20 text-left">
                    <th className="py-1 pr-3">ตัวเลือก</th>
                    <th className="py-1 pr-3 text-right">ห้อง</th>
                    <th className="py-1 pr-3 text-right">คะแนนเสียง</th>
                    <th className="py-1 text-right">% ของผู้ลงคะแนน</th>
                  </tr>
                </thead>
                <tbody>
                  {(question.choices ?? []).map((choice, choiceIndex) => (
                    <tr className="border-b border-black/10" key={choice.id ?? choiceIndex}>
                      <td className="py-1 pr-3">{choice.text}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{choice.vote_count ?? 0}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{pct(choice.ownership)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {pct(choice.percent_of_submitted_ownership)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 font-semibold">ผล: {thaiOutcome(question.outcome, decided)}</p>
              {question.requires_land_office_registration ? (
                <p>ต้องจดทะเบียนต่อพนักงานเจ้าหน้าที่</p>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="mt-5">
        <h2 className="text-base font-bold">5. เหตุขัดข้องระหว่างการลงคะแนน</h2>
        {incidents.length === 0 ? (
          <p className="mt-2">ไม่มีเหตุขัดข้องที่บันทึกไว้</p>
        ) : (
          <ol className="mt-2 list-decimal pl-6">
            {incidents.map((incident, index) => (
              <li key={index}>
                {formatThaiDateTime(incident.started_at)}
                {incident.ended_at ? ` ถึง ${formatThaiDateTime(incident.ended_at)}` : ""}: {incident.description}
                {incident.action_taken ? ` — การดำเนินการ: ${incident.action_taken}` : ""}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-5">
        <h2 className="text-base font-bold">6. การอนุมัติผล</h2>
        {approvals.length === 0 ? (
          <p className="mt-2">ยังไม่มีการอนุมัติ</p>
        ) : (
          <ol className="mt-2 list-decimal pl-6">
            {approvals.map((approval, index) => (
              <li key={index}>
                {approval.profiles?.full_name ?? "-"} อนุมัติเมื่อ {formatThaiDateTime(approval.approved_at)}
                {approval.notes ? ` — ${approval.notes}` : ""}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-1">
          {publication
            ? `เผยแพร่ผลเมื่อ ${formatThaiDateTime(publication.published_at)} (อนุมัติ ${publication.approvals_count} คน)`
            : "ยังไม่เผยแพร่ผล"}
          {settings?.result_notice_days
            ? ` · ต้องแจ้งเจ้าของร่วมภายใน ${settings.result_notice_days} วันตามข้อบังคับ`
            : ""}
        </p>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-bold">7. การรับรองเอกสาร</h2>
        <table className="mt-2 w-full">
          <tbody>
            <Row label="เลขอ้างอิงผลการลงมติ">
              <span className="font-mono text-xs">{snapshot.id}</span>
            </Row>
            <Row label="สร้างผลเมื่อ">{formatThaiDateTime(snapshot.generated_at)}</Row>
            <Row label="ค่าตรวจสอบ SHA-256">
              <span className="break-all font-mono text-xs">{hash}</span>
            </Row>
          </tbody>
        </table>
        <p className="mt-2 text-xs">
          ค่าตรวจสอบคำนวณจากข้อมูลผลการลงมติที่ระบบเก็บไว้ ใช้ยืนยันว่าเอกสารฉบับนี้ตรงกับผลในระบบ
        </p>
        <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-12">
          {signatories.map((role) => (
            <div className="text-center" key={role}>
              <div className="border-b border-dotted border-black/60 pb-6" />
              <p className="mt-2">(.......................................................)</p>
              <p>{THAI_SIGNATORIES[role] ?? role}</p>
              <p>วันที่ ......../......../........</p>
            </div>
          ))}
        </div>
      </section>

      {settings?.document_footer ? (
        <footer className="mt-8 border-t border-black/20 pt-2 text-xs">{settings.document_footer}</footer>
      ) : null}
    </main>
  );
}

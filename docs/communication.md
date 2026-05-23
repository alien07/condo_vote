# Communication

This document covers email events, notification ordering, retries, and PDF result summary scope.

## Email Events

### Invitation
Trigger: meeting is published and eligible voters are ready.
Recipients: eligible owners and approved proxies for the meeting.
Content:
- Meeting title
- Voting window
- Voting link
- Basic support/contact text

### Reminder
Trigger: admin action or scheduled reminder before voting closes.
Recipients: eligible voters who have not submitted a ballot.
Content:
- Meeting title
- Voting deadline
- Voting link

### Result Approved
Trigger: committee/admin creates `committee_approvals` for a result snapshot.
Recipients: owners and residents with active email addresses.
Content:
- Meeting title
- Result summary
- Link to approved result page or generated PDF

### PDF Result Delivery
Trigger: result is approved and PDF summary is generated.
Recipients: owners and residents with active email addresses.
Content:
- Meeting title
- PDF attachment or signed download link
- Approval timestamp

## Send Ordering
- Post-approval result emails must be sent to owners and residents after voting closes and committee approval is recorded.
- Because daily email limits may apply, emails should be queued and sent in descending active date/time order.
- The active date/time should represent the most recent relevant activity or active registration timestamp available for the recipient.
- Failed sends should not block the whole queue.

## Retry And Logging
- Every send attempt should create or update an `email_logs` record.
- Log template key, recipient email, status, provider message ID, sent timestamp, and error message.
- Retry transient failures with a capped retry count.
- Do not retry permanent failures such as invalid recipient format.
- Do not log sensitive document URLs if they contain signed access tokens.

## PDF Summary Scope
The generated PDF can be adjusted later, but the MVP should include:
- Project or condominium name if configured.
- Meeting title and description.
- Voting start/end time.
- Result approval timestamp.
- Approver name or role.
- Question list.
- Choice-level vote count by room.
- Choice-level ownership percentage against total project ownership.
- Choice-level ownership percentage against submitted-vote ownership.
- Notes that results are based on the latest valid ballot per room.

## Open Questions
- Should result emails include the PDF as an attachment or a signed download link?
- What is the daily email limit of the selected provider?
- What field should define recipient active date/time if several exist?

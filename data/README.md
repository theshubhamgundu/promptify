# Sample event-import data

`team-duos-import.csv` contains 10 sample teams, each with exactly two members.
`coordinators-import.csv` contains 10 sample coordinator accounts.

All `example.test` emails are deliberately non-deliverable. Replace every email, phone number, roll number, and temporary password before a production import.

Do not import coordinator passwords into a public table. Coordinator accounts must be created in Supabase Auth, with a matching `public.users` profile whose role is `COORDINATOR`. Team data must go through the `register-team` Edge Function so it creates one shared team login, links it to the team, and sends credentials to both members.

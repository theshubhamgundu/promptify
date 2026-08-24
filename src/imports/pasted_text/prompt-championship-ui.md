# Figma Make Prompt — Prompt Engineering Championship UI

Design a complete, production-quality **participant portal UI for a 5-round Prompt Engineering Championship**.

This is a serious **5–6 hour B.Tech-level AI competition**, not a normal quiz website.

The UI must feel:

* Premium
* Competitive
* Modern
* Technical
* Clean
* Fast to understand
* Professional enough for a large college-level flagship event

Do **not** use dark cyberpunk/neon styling.

Use a **bright, clean visual system** inspired by modern event platforms:

* White / warm white background
* Soft cream sections
* Orange as primary action color
* Deep red/orange for important states
* Yellow for warnings/bonuses
* Green for success
* Purple only for AI-specific elements where useful
* Thin borders
* Soft shadows
* Large rounded cards
* Subtle gradients
* Minimal decorative waves/dots
* Strong typography hierarchy

Do not include any college/event-specific branding such as VANSH. Use:

**PROMPT CHAMPIONSHIP**

Tagline:

**Think. Prompt. Solve. Win.**

---

# 1. Design System

Create reusable Figma components for:

* Buttons
* Cards
* Badges
* Status pills
* Timers
* Progress bars
* Score cards
* Question cards
* Round cards
* Team member cards
* Leaderboard rows
* Tables
* Tabs
* Modals
* Confirmation dialogs
* Toasts
* Alerts
* Tooltips
* Inputs
* Textareas
* Code editor containers
* AI output panels
* Submission panels
* Attempt indicators
* Hint indicators
* Lock states
* Success/error states
* Empty states
* Loading states
* Offline/reconnecting states

Use consistent spacing and responsive layouts.

Desktop is the primary target because participants will use a controlled desktop/laptop.

---

# 2. Participant Layout

Create a persistent left sidebar.

Navigation:

* Dashboard
* Rounds
* My Progress
* Leaderboard
* Team
* Submissions
* Discussion
* Announcements
* Help & Rules

Bottom of sidebar:

**Need Help?**
Contact Support

Top navigation:

* Team Code
* Copy Team Code
* Event Timer
* Team name
* Team members
* Profile dropdown

Do not overload the navigation.

---

# 3. Participant Dashboard

Create the main participant dashboard.

### Header

```text
Welcome back,
Team Alpha 👋

Think. Prompt. Solve. Win.
```

Top cards:

**Team Code**
PC5247
Copy button

**Event Timer**
05 : 23 : 47

**Team**
Team Alpha
2 Members

---

# 4. Hero Section

Large event banner:

**PROMPT ENGINEERING CHAMPIONSHIP**

Subtitle:

**A battle of creativity, logic, and AI mastery.**

Supporting text:

**Use AI wisely. Think deeper. Outperform.**

Include a clean AI illustration:

* AI brain
* prompt symbols
* code
* chatbot
* structured data

Avoid excessive futuristic graphics.

Button:

**View Event Details →**

---

# 5. Event Rounds Section

Create five round cards.

### Round 1

**AI IQ**

AI + Tech Quiz

Status:
UPCOMING / LIVE / COMPLETED

Description:

**Test your understanding of AI, LLMs, prompt engineering and emerging technologies.**

### Round 2

**Prompt Heist**

Break & Build

Description:

**Engineer prompts that solve challenging real-world tasks.**

### Round 3

**AI Escape Room**

Solve the Impossible

Description:

**Solve interconnected AI-powered puzzles and uncover hidden clues.**

### Round 4

**AI Battle Royale**

Survive & Rank

Description:

**Build, test and defend your AI solution against hidden challenges.**

### Round 5

**AI Grandmaster**

Ultimate Mission

Description:

**Build a complete AI-powered solution under strict time constraints.**

Each card must show:

* Round number
* Icon
* Name
* Description
* Status
* Duration
* Maximum score
* Lock/unlock state
* Progress

---

# 6. Team Panel

Right-side card:

**TEAM MEMBERS**

Example:

Team Alpha

Participant 1

* Online
* Leader

Participant 2

* Online
* Member

Button:

**Team Chat**

Also show:

* Device status
* Verification status
* Session status

Example:

**✓ Team Verified**

---

# 7. Announcements

Card:

**ANNOUNCEMENTS**

Examples:

Welcome to the Championship!

Round 1 starts at 10:30 AM.

Keep your team ready.

Show timestamp.

---

# 8. Current Rank

Card:

**YOUR CURRENT RANK**

Show:

Rank
Score
Teams ahead
Teams behind

If not ranked:

**Not Yet Ranked**

---

# 9. How It Works

Create a four-step visual:

**01**
Read the challenge

↓

**02**
Use AI wisely

↓

**03**
Submit within limits

↓

**04**
Earn points & climb the leaderboard

---

# 10. Important Rules

Display:

* Limited attempts apply to selected challenges
* Speed bonuses may be available
* Hints can reduce score
* Final submissions cannot be changed
* AI usage depends on the round
* Follow event rules
* Suspicious activity may be reviewed

Use clear icons.

---

# 11. Round Overview Screen

Create a dedicated **Rounds Overview** page.

Display all five rounds vertically or as large cards.

For every round show:

* Round number
* Name
* Description
* Status
* Duration
* Maximum score
* Attempts
* AI allowed/not allowed
* Unlock condition

Right panel should show selected-round details.

---

# 12. Round 1 — AI IQ

Create a dedicated round briefing screen.

Header:

**Round 1: AI IQ**

Status:
LIVE

Timer:
23:45

Maximum score:
200

Show:

**About this Round**

25–30 difficult MCQs covering:

* AI
* LLMs
* Prompt engineering
* AI tools
* Reasoning
* Data
* Emerging AI concepts

AI usage:

**AI NOT ALLOWED**

Round flow:

1. Read question
2. Select answer
3. Mark for review
4. Submit
5. Score calculated

---

# 13. Round 1 — Question Screen

Create a professional examination interface.

Show:

**Question 7 of 25**

Question navigator:

1 2 3 4 5 6 7 8 9 10 ...

States:

* Answered
* Unanswered
* Marked for review
* Current

Question card:

Question text

Four options:

A
B
C
D

Bottom:

Previous

Next

Right panel:

* Time remaining
* Progress
* Question navigator
* Instructions

Bottom:

**Review & Submit**

---

# 14. Round 1 — Submission Screen

Show:

**Review Your Answers**

Display:

* Answered
* Unanswered
* Marked for review
* Time remaining

Button:

**Submit Round**

Confirmation modal:

**Submit Round 1?**

Once submitted:

**This action cannot be undone.**

---

# 15. Round 2 — Prompt Heist

This must feel completely different from Round 1.

Header:

**Round 2: Prompt Heist**

Subtitle:

**Engineer the perfect prompt.**

Show:

### Challenge

Problem statement

### Input Data

Large text/code/data panel.

### Your Task

Clear requirements.

### Constraints

Example:

* Return JSON only
* No additional explanation
* Required fields must exist
* Missing values → null
* Hidden test cases will be used

---

# 16. Prompt Workspace

Main workspace must contain:

### Your Prompt

Large editor.

Features:

* Line numbers
* Auto-save indicator
* Clear
* Save Draft
* Test Run

Bottom:

Model:
**BYOK**

Token count

Estimated cost

API status

Button:

**Run Prompt**

---

# 17. AI Output

Large output panel.

Show:

**AI OUTPUT**

Formatted result.

Include:

* Copy
* Expand
* Raw output
* Validation status

Example:

✓ Valid JSON

✓ Required fields present

⚠ Missing optional field

---

# 18. Submission Panel

Show:

**Attempts Left: 2 / 3**

Submission history:

Attempt 1
Score: 120 / 200

Attempt 2
Score: 160 / 200

Attempt 3
Not submitted

Button:

**Submit Attempt**

Clearly explain:

**Submitting consumes one attempt.**

Testing the prompt does NOT consume an attempt.

---

# 19. Speed Bonus UI

For selected challenges:

Create a visually distinct but clean card:

**⚡ SPEED BONUS**

Solve within:

**02:00**

Bonus:

**+5 points**

Show countdown.

Do not make the UI distracting.

---

# 20. Hint System

Create:

**Need a Hint?**

Hint 1
−5 points

Hint 2
−10 points

Hint 3
−15 points

Confirmation:

**Using this hint will reduce your available score. Continue?**

---

# 21. Round 3 — AI Escape Room

This should visually feel like a mission rather than an exam.

Header:

**Round 3: AI Escape Room**

Subtitle:

**Solve. Discover. Escape.**

Main section:

### Mission Brief

Explain the story and objective.

### Puzzle Board

Display interconnected puzzle cards:

1. Logic Lock
2. Code Cipher
3. Pattern Grid
4. Text Enigma

Each card has:

* Locked/unlocked
* Solved/unsolved
* Attempts
* Score

---

# 22. Puzzle Workspace

Show:

**Puzzle 1 — Logic Lock**

Puzzle description

Clues

Question

Answer field

Buttons:

**Check Answer**

**Use Hint**

**Next Puzzle**

Show:

**Key Progress**

□ □ □ □

Each solved puzzle reveals one part of the final key.

---

# 23. Round 4 — AI Battle Royale

This should feel like an AI testing laboratory.

Header:

**Round 4: AI Battle Royale**

Subtitle:

**Build. Test. Defend. Survive.**

Main areas:

### Mission

Problem statement

### Your Solution

Prompt/code/configuration editor

### Test Environment

Input

Run Test

Output

### Test Results

Show:

Passed tests

Failed tests

Accuracy

Robustness

Security

Efficiency

Do NOT reveal hidden test cases.

---

# 24. Hidden Evaluation

Create a panel:

**Evaluation Status**

Visible tests:
12 / 12

Hidden tests:
LOCKED

Adversarial tests:
LOCKED

Final score:
Not yet calculated

After submission:

**Running evaluation...**

Then:

✓ Functional tests

✓ Edge cases

✓ Security checks

✓ AI quality evaluation

---

# 25. Round 5 — AI Grandmaster

This is the largest and most advanced interface.

Header:

**Round 5: AI Grandmaster**

Subtitle:

**The ultimate AI engineering mission.**

Show:

Timer

Maximum score

Team

Mission status

---

# 26. Grandmaster Workspace

Use a multi-panel workspace.

Tabs:

**Mission**
**Requirements**
**Data**
**Workspace**
**Tests**
**Submission**

Mission panel:

Full real-world problem.

Requirements:

Checklist.

Data:

Provided files.

Workspace:

Prompt + code + configuration.

Tests:

Visible test results.

---

# 27. Final Evaluation

Show:

**FINAL SUBMISSION**

Before submission:

* Requirements completed
* Tests passed
* Files included
* AI configuration valid
* Team submission ready

Button:

**Submit Final Solution**

Confirmation:

**Final submission is permanent.**

After submission:

**Evaluation in progress**

Then show:

* Functional score
* AI quality score
* Robustness
* Security
* Efficiency
* Final score

---

# 28. Leaderboard

Create a professional live leaderboard.

Columns:

Rank

Team

Score

Rounds Completed

Latest Change

Status

Use subtle animations when rankings change.

Do not reveal sensitive participant information.

---

# 29. My Progress

Show:

* Total score
* Current rank
* Round progress
* Accuracy
* Attempts used
* Speed bonuses
* Hints used
* Best round
* Weakest round

Use clean charts.

---

# 30. Submissions

Create a submission history page.

Columns:

Round

Challenge

Attempt

Score

Submitted At

Status

View Details

Allow participants to inspect their own submissions only.

---

# 31. Verification Screen

Before competition access, create a locked screen.

Show:

**WAITING FOR COORDINATOR VERIFICATION**

Team:

Team Alpha

Members:

Participant 1
Participant 2

Device:

Verified

Coordinator:

Pending

QR code:

**Scan this code with the coordinator device**

Until approved:

**Competition remains locked.**

After approval:

**✓ Verification Complete**

**Competition Access Granted**

---

# 32. Locked State

Create a reusable locked-screen component.

Show:

🔒

**Round Locked**

Reason:

**Complete Round 1 to unlock Round 2.**

Do not show hidden challenge content.

---

# 33. Offline / Reconnection States

Create screens/components for:

### Internet disconnected

**Connection Lost**

Your work is safely stored locally.

**Reconnecting...**

### Reconnected

**Connection Restored**

Your latest progress has been synchronized.

### Sync conflict

**Sync Required**

Choose the latest verified state.

---

# 34. Session Security UI

Show unobtrusive status indicators:

**✓ Device Verified**

**✓ Team Session Active**

**✓ Secure Session**

If suspicious behavior occurs:

**Session Alert**

Your activity requires coordinator review.

Do not automatically accuse the participant.

---

# 35. Responsive Design

Primary:

**1440 × 900 desktop**

Also design:

* 1920 × 1080
* 1366 × 768
* Tablet fallback

Do NOT prioritize mobile because the competition is designed around controlled desktop devices.

---

# 36. UX Rules

The interface must:

* Never overwhelm the participant
* Make the current task obvious
* Always show remaining time
* Always show score/attempt status where relevant
* Clearly distinguish Test from Submit
* Clearly distinguish Hint from Submit
* Clearly show locked/unlocked states
* Prevent accidental final submission through confirmation
* Show autosave status
* Show connection status
* Avoid unnecessary animations
* Avoid excessive gradients
* Avoid excessive glassmorphism
* Avoid neon cyberpunk styling
* Avoid decorative elements that interfere with readability

---

# 37. Required Figma Screens

Create all screens as separate frames:

1. Login
2. Verification Pending
3. Verification Approved
4. Participant Dashboard
5. Rounds Overview
6. Round Details
7. Round 1 Briefing
8. Round 1 Question
9. Round 1 Review
10. Round 1 Result
11. Round 2 Briefing
12. Round 2 Prompt Workspace
13. Round 2 Test Output
14. Round 2 Submission
15. Round 2 Result
16. Round 3 Briefing
17. Round 3 Puzzle Board
18. Round 3 Puzzle Workspace
19. Round 3 Final Key
20. Round 3 Result
21. Round 4 Briefing
22. Round 4 AI Workspace
23. Round 4 Test Results
24. Round 4 Hidden Evaluation
25. Round 4 Result
26. Round 5 Mission Brief
27. Round 5 Workspace
28. Round 5 Test Environment
29. Round 5 Final Submission
30. Round 5 Evaluation
31. Final Results
32. Live Leaderboard
33. My Progress
34. Submission History
35. Team
36. Announcements
37. Help & Rules
38. Offline State
39. Reconnecting State
40. Session Alert

---

# 38. Prototype Interactions

Connect the prototype so that:

Login
→ Verification
→ Dashboard
→ Round Overview
→ Round Briefing
→ Round Workspace
→ Submission
→ Result
→ Next Round

Also demonstrate:

* Attempt decrement
* Timer
* Hint penalty
* Speed bonus
* Locked rounds
* AI output
* Test Run vs Submit
* Submission confirmation
* Offline state
* Reconnection
* Leaderboard update

---

# 39. Important Architecture Requirement

This is a UI prototype, but design every screen assuming that the real application will be **database-driven and admin-configurable**.

Do not design anything that requires hardcoded:

* Round names
* Questions
* Scores
* Timers
* Attempt limits
* Bonuses
* Penalties
* Hints
* Evaluation rules
* AI providers
* Challenge content

All of these will eventually come from the admin dashboard/database.

The UI should therefore use reusable components and dynamic states.

---

# Final Design Direction

The final product should feel like:

**A professional AI competition platform + examination system + AI workspace + competitive leaderboard.**

It should NOT look like:

* A school quiz
* A generic LMS
* A chatbot
* A hackathon registration website
* A gaming website
* A cyberpunk dashboard

Prioritize **clarity, competition, AI tooling, reliability and professional event experience**.

Generate the complete design system and all participant-facing screens as a consistent design system with reusable components and realistic prototype interactions.

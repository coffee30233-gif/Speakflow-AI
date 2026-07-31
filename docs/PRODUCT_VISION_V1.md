# Design Philosophy

Most AI interview products focus on asking better questions.

SpeakFlow focuses on building better interview habits.

Most products evaluate users.

SpeakFlow coaches users.

Most products simulate interviews.

SpeakFlow builds confidence before interviews.

The goal is not to replace interview practice.

The goal is to help users become someone who can confidently tell their own stories in English.

# SpeakFlow AI V1 Product Vision

Before we continue developing SpeakFlow AI, I want to redefine the product direction.

Please read the following carefully because this will become the core philosophy of the entire product.

---

# Product Positioning

SpeakFlow AI is NOT a general English learning app.

It is NOT an IELTS speaking app.

It is NOT a generic AI interview simulator.

SpeakFlow AI is an AI Interview Coach designed specifically for Optical Engineers preparing for the ASML Production Engineer (Optics) interview.

Everything should be designed around this target user.

Target Company

ASML

Target Position

Production Engineer (Optics)

Target User

Optical Engineer

---

# Core Mission

Most interview apps only improve English.

I want SpeakFlow to improve two different abilities.

1.

Interview Ability

2.

Memory Recall Ability

These two abilities should become two independent practice modes.

---

# Practice Modes

SpeakFlow V1 only contains TWO modes.

## 1. Interview Mode

Purpose

Simulate a real ASML interview.

AI acts as a professional interviewer.

It should include

• HR Interview

• Production Manager

• Senior Optical Engineer

The AI should

• Ask follow-up questions naturally

• Evaluate technical depth

• Evaluate STAR structure

• Evaluate communication

• Evaluate engineering thinking

• Provide detailed feedback

This mode is for realistic interview simulation.

---

## 2. Mind Map Recall Mode (Core Feature)

This is NOT another interview mode.

This is the most important feature of SpeakFlow.

The problem I personally have is not English.

My biggest problem is:

When the interviewer asks a question,

my mind suddenly goes blank.

I know the answer.

I know my experience.

But I cannot quickly recall my own stories.

Therefore,

Mind Map Recall Mode is designed to train memory retrieval rather than English.

Its purpose is:

Question

↓

Recall

↓

Speak

NOT

Question

↓

Read Answer

↓

Speak

The goal is to train users to retrieve their own experience quickly.

Do NOT train users to memorize scripts.

Train users to remember structures.

---

# Mind Map Workflow

Choose Question

↓

Build Personal Mind Map

↓

Recall Training

↓

AI Hint

↓

Speak

↓

Feedback

↓

Repeat

The user should first build a personal Mind Map based on their own experience.

For example

Tell me about yourself

Education

Experience

Skills

Goal

Each node can be expanded into more detailed information.

---

# Recall Training

The system gradually hides the Mind Map.

Level 1

Show everything.

Level 2

Show only first-level nodes.

Level 3

Show only the interview question.

The user must recall the entire answer structure independently.

---

# AI Hint

If the user cannot answer within five seconds,

do NOT reveal the answer immediately.

Instead,

provide progressive hints.

Example

Hint 1

Education

Hint 2

Education

↓

Master

Hint 3

Show the complete branch

The AI should encourage recall,

not dependence.

---

# Recall Metrics

Record

Recall Time

How many seconds before speaking

Completeness

Whether all key nodes were covered

Confidence

How natural the answer sounded

English

Grammar

Vocabulary

Fluency

The user should be able to see long-term improvement.

---

# Conversation Style

I do NOT want SpeakFlow to feel like a chatbot that keeps asking interview questions.

There should be two different AI personalities.

Interview Mode

The AI behaves like a professional interviewer.

Formal.

Objective.

Realistic.

Coach Mode (used in Mind Map Recall)

The AI behaves like a mentor.

Friendly.

Patient.

Supportive.

Instead of constantly asking questions,

the AI should occasionally have short natural conversations with the user.

Examples

"How has your day been?"

"How is work recently?"

"Have you learned anything interesting this week?"

"Ready for another question?"

This makes practice feel much more natural.

The AI should feel like a real coach instead of a testing machine.

---

# Future Architecture

The Mind Map should eventually be stored in Supabase.

Each question will have

• Personal Mind Map

• Personal Stories

• Best Answer

This will later become

My Answer Bank.

Future versions may include

Spaced Repetition

Adaptive Recall

Daily Practice

Personal Progress

---

# Development Principles

Please prioritize user experience over adding more features.

The product should feel simple.

Every feature should support one of these two goals:

1.

Become better at interviews.

2.

Recall personal experiences faster.

If a feature does not support these goals,

do not add it.

---

Please review this product vision first.

Then redesign the architecture, UI flow, database structure, and development roadmap based on this philosophy before writing any code.

# Voice Coach Experience (Highest UX Priority)

One of the most important goals of SpeakFlow AI is to create the feeling that the user is talking to a real English interview coach.

This is NOT simply text-to-speech.

This is a complete conversational experience.

The user should forget they are talking to AI.

Instead,

they should feel they are practicing with the same coach every day.

---

## Voice-first Experience

The Coach should speak naturally.

The user should be able to answer by voice.

The interaction should feel like a real conversation instead of taking turns typing messages.

The app should always prioritize voice interaction.

Text should only be a supporting interface.

---

## Natural Conversation

The Coach should not immediately ask interview questions.

Before practice,

it should start with small talk.

Examples

"Hi Lynn, welcome back."

"How has your day been?"

"How's work recently?"

"Ready for today's practice?"

During practice,

the Coach can occasionally have short conversations.

Examples

"That was a much better answer."

"I like your example."

"I noticed you answered faster today."

"Let's take a short break."

These conversations should make the practice feel natural.

---

## Natural Speaking Style

The Coach should never sound like a robot.

It should include

• Natural speaking speed

• Short pauses

• Thinking pauses

• Emotional variation

• Encouragement

• Friendly tone

The Coach should sound calm, experienced and supportive.

---

## Long-term Relationship

The Coach should remember previous practice sessions.

Examples

"Yesterday we practiced Why ASML."

"Your STAR structure improved a lot."

"Last time you hesitated for about 15 seconds."

"Today you answered much faster."

The user should feel that the Coach remembers them.

---

## Coach Personality

The Coach is not an examiner.

The Coach is a mentor.

It should encourage progress instead of judging mistakes.

When the user struggles,

the Coach should help them recover naturally instead of immediately giving the correct answer.

---

## Emotional Experience

The goal is not only to improve English.

The goal is to make users enjoy practicing every day.

After opening SpeakFlow,

users should feel

"I'm meeting my coach again."

instead of

"I'm opening another AI app."

This emotional experience is one of the most important design principles of SpeakFlow AI.
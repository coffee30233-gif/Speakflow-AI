# MIND_MAP_RECALL_MODE.md

# Mind Map Recall Mode

## Purpose

Mind Map Recall is the signature feature of SpeakFlow AI.

Unlike traditional interview simulators that repeatedly ask questions,
Mind Map Recall focuses on strengthening the user's memory retrieval
process.

The goal is not to memorize English sentences.

The goal is to quickly recall personal experiences, organize ideas, and
express them naturally in English.

------------------------------------------------------------------------

# Design Philosophy

Most interview failures are not caused by poor English.

Instead, candidates often fail because they cannot retrieve their own
stories under pressure.

SpeakFlow solves this problem by training the following process:

Question

↓

Recall Structure

↓

Recall Story

↓

Organize Thoughts

↓

Speak Naturally

Instead of:

Question

↓

Memorized Script

↓

Forget Everything

Mind Map Recall teaches users to remember ideas rather than sentences.

------------------------------------------------------------------------

# Objectives

Mind Map Recall should help users:

-   Recall personal experiences within seconds
-   Organize answers logically
-   Speak naturally without memorizing scripts
-   Build long-term interview confidence

------------------------------------------------------------------------

# Knowledge Structure

Every interview question should have its own knowledge package.

Each package contains:

Question

↓

Mind Map

↓

Chinese Story

↓

STAR Structure

↓

Keywords

↓

Best English Answer

The Mind Map is the central source of truth.

All other features should reference the same data.

------------------------------------------------------------------------

# Mind Map Structure

Mind Maps should be stored as structured JSON instead of images.

Example

Question

Tell me about yourself

Mind Map

-   Education
    -   Master's Degree
    -   Applied Physics
-   Experience
    -   Optical Engineer
    -   Six years
-   Skills
    -   Optical Testing
    -   Alignment
    -   Beam Profiler
-   Goal
    -   Join ASML
    -   Production Engineer

------------------------------------------------------------------------

# Recall Training Flow

1.  Choose an interview question.
2.  Display the complete Mind Map.
3.  User reviews the structure.
4.  Hide selected branches.
5.  User begins speaking.
6.  AI evaluates recall quality.
7.  Save the practice history.

------------------------------------------------------------------------

# Progressive Recall

-   Level 1: Complete Mind Map visible.
-   Level 2: Only first-level nodes visible.
-   Level 3: Only root topic visible.
-   Level 4: Blank screen.

The user should gradually recall everything independently.

------------------------------------------------------------------------

# AI Hint System

If the user hesitates for several seconds, the AI should reveal hints
progressively.

Example:

-   Hint Level 1: Education
-   Hint Level 2: Education → Master's Degree
-   Hint Level 3: Education → Master's Degree → Applied Physics

The goal is to stimulate memory instead of giving away the answer.

------------------------------------------------------------------------

# Recall Metrics

Measure:

-   Recall Time
-   Completeness
-   Logical Structure
-   Confidence
-   Fluency
-   Grammar
-   Vocabulary

Each session generates an overall Recall Score.

------------------------------------------------------------------------

# Progress Tracking

Track improvement over time:

-   Recall Time
-   Practice Count
-   Completeness
-   Recall Score

------------------------------------------------------------------------

# Coach Notes

After each session, the AI Coach provides personalized observations.

Examples:

-   "You recalled your project faster today."
-   "Try adding more measurable results."
-   "Excellent confidence. Continue improving your conclusion."

------------------------------------------------------------------------

# Integration

Mind Map Recall becomes the foundation for:

-   Interview Mode
-   Voice Coach
-   My Answer Bank
-   Daily Practice
-   Adaptive Learning
-   Progress Dashboard

All modules share the same Mind Map data.

------------------------------------------------------------------------

# Technical Requirements

Support:

-   JSON storage
-   React Flow
-   Tree View
-   Drag-and-drop editing
-   Expand / Collapse
-   Future AI auto-generation

The data structure should remain independent from UI implementation.

------------------------------------------------------------------------

# Future Expansion

-   AI-generated Mind Maps
-   Automatic STAR extraction
-   Keyword recommendations
-   Adaptive Recall Difficulty
-   Spaced Repetition
-   Daily Recall Challenge
-   Team Interview Mode
-   Company-specific templates

------------------------------------------------------------------------

# Success Criteria

Mind Map Recall is successful when users can:

-   Recall answers without memorizing scripts.
-   Speak naturally from ideas.
-   Reduce response hesitation.
-   Build long-term interview confidence.

**Train memory first. English becomes natural afterward.**

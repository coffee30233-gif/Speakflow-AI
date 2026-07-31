# KNOWLEDGE_BASE_SPEC.md

# Knowledge Base Specification

## Purpose

The Knowledge Base is the single source of truth for all interview
content in SpeakFlow AI.

All modules should read from the same knowledge structure.

------------------------------------------------------------------------

# Core Structure

Interview Question

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

↓

Practice History

------------------------------------------------------------------------

# Categories

-   HR
-   Behavioral
-   Technical
-   Optical Engineering
-   Production Engineering
-   ASML
-   Leadership
-   Communication

------------------------------------------------------------------------

# My Answer Bank

Each question stores:

-   Question
-   Mind Map (JSON)
-   Chinese Story
-   STAR
-   Keywords
-   Best Answer
-   Notes
-   Last Updated

------------------------------------------------------------------------

# Project Database

Each project should include:

-   Project Name
-   Background
-   Responsibilities
-   Challenges
-   Actions
-   Results
-   Technologies
-   Skills
-   Keywords

Projects should be reusable across multiple interview questions.

------------------------------------------------------------------------

# Knowledge Relationships

One Project

↓

Multiple Interview Questions

↓

Multiple Practice Sessions

↓

Progress Tracking

------------------------------------------------------------------------

# AI Usage

The AI should use the Knowledge Base to:

-   Generate follow-up questions
-   Evaluate completeness
-   Suggest missing points
-   Generate Mind Maps
-   Produce Coach Notes

------------------------------------------------------------------------

# Design Principles

-   Store structured data, not documents.
-   Separate content from UI.
-   Make every knowledge object reusable.
-   Support future expansion without schema redesign.

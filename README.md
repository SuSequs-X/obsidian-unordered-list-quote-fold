# Unordered List Quote Fold

A minimal Obsidian plugin that collapses unordered list branches containing standard Markdown blockquotes (`>`).

## Core Mechanism

> Collapse only those unordered list branches whose content includes standard blockquotes, while preserving the original list structure and indentation.

This plugin does **not** aim to provide generic list folding.  
It is designed for a very specific pattern:

- bullet list
  - nested content
    > quoted detail / explanation / reference

## Features

- Targets **unordered (bullet) lists only**
- Detects nested branches that contain standard blockquotes (`>`)
- Collapses those branches by default
- Expands on:
  - click
  - hover (optional)
- Marker displayed outside the list:
  - left
  - right
- Keeps original list indentation unchanged
- Minimal, native-style settings UI with tabs

## Scope

This plugin is intentionally constrained.

It works with:

- Unordered lists (`-`, `*`)
- Standard Markdown blockquotes (`>`)
- Reading view

It does **not** support:

- Ordered lists
- Callouts
- Embeds
- Non-blockquote containers
- Generic folding for all list items

## Why

In structured notes, blockquotes inside lists often represent:

- supplementary explanations
- references
- commentary

Keeping them always expanded introduces visual noise and reduces scan efficiency.

This plugin keeps the main list compact by folding only quote-containing branches, without altering the document layout.

## Marker Behavior

Two marker positions are supported:

- Outside left
- Outside right

No internal or inline marker modes are provided, to avoid layout complexity.

## Settings

The settings panel is designed to remain minimal and close to native Obsidian style.

Tabs:

- Interaction
- Marker
- Expand

Typical options include:

- Expand on click
- Expand on hover
- Hover delay
- Marker emoji or text
- Marker size
- Marker opacity
- Marker position (left / right)

## Design Principles

- Narrow scope over feature breadth
- No modification of original indentation
- No interference with document structure
- Minimal UI surface
- Predictable behavior

## Compatibility

This plugin depends on the rendered DOM structure in Obsidian reading view.

Behavior may vary if your theme or CSS snippets significantly modify:

- list indentation
- blockquote layout
- nested list rendering

## Installation

### Manual Installation

1. Download the latest release
2. Extract into:

   `.obsidian/plugins/unordered-list-quote-fold/`

3. Ensure the folder contains:

   - `main.js`
   - `manifest.json`
   - `styles.css`

4. Enable the plugin in Obsidian → Community Plugins

## Example

```md
- Main idea
  - Supporting detail
    > This part will be folded
```

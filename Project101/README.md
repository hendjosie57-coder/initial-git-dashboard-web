# Code Intelligence Dashboard

A visual dashboard for analyzing code dependencies, technical debt, and file-level metrics at a glance.

## Overview

This tool visualizes your codebase as an interactive dependency graph, making it easy to:
- **Spot high-risk files** with visual risk indicators (low/medium/high)
- **Track technical debt** with composite debt scores (0–100)
- **Understand code ownership** through author contribution breakdowns
- **Explore file metrics** like complexity, churn, coverage, and commit history
- **Ask AI** contextual questions about specific files

## How to Use

### 1. **Main Graph View**
When you open the dashboard, you'll see an interactive graph where each node represents a file. 

- **Node colors & size**: Indicate risk level and debt score
  - Brighter/larger nodes = higher technical debt
  - Red tones = high risk; yellow = medium; green = low risk
- **Edges**: Show dependencies between files
- **Click a node**: Opens the file inspector drawer on the left

### 2. **File Inspector Drawer**
When you click on a file node, a side panel slides in with:

- **Debt Score Gauge**: Circular gauge showing 0–100 composite score
- **File Description**: Quick summary of what the file does
- **Metrics Grid** (6 stats):
  - **Lines**: Total lines of code
  - **Complexity**: Cyclomatic complexity estimate
  - **Churn / 90d**: Number of commits in last 90 days (volatility)
  - **Coverage**: Test coverage percentage
  - **Commits**: Total commits to this file
  - **Dependents**: How many other files depend on this one

### 3. **Action Buttons**

At the bottom of the drawer:

- **Open Refactor Sandbox**: Spin up an isolated environment to refactor the file and see real-time impact metrics
- **Ask AI**: Open the chat pane to ask contextual questions about the file

### 4. **Chat Pane** (Right side)
Slides in from the right when you click **Ask AI**. Ask questions like:
- "Explain what this file does"
- "Find weaknesses in this code"
- "Show me the history of changes"

### 5. **Refactor Sandbox**
A dedicated workspace where you can:
- Edit the file code
- See live impact metrics (complexity delta, LOC before/after, coverage change, regression risk)
- Estimate how your changes affect dependent files

## Keyboard & Navigation

- **Click graph nodes** to inspect files
- **Drag to pan** the graph view
- **Scroll to zoom** in/out
- **Click X** to close the file drawer
- **Click X** to close the chat pane

## File Risk Levels

- **🟢 Low**: Stable, well-tested, low complexity
- **🟡 Medium**: Moderate churn or complexity, some coverage gaps
- **🔴 High**: High debt score, frequent changes, complex logic, or poor coverage

## Quick Tips

- Start by looking for **red nodes** — these are your highest-priority refactoring targets
- Files with **high churn** (40+ commits/90d) need attention even if complexity is moderate
- **Coverage < 30%** shows as red to signal untested code
- Use the **Sandbox** to experiment; impact metrics guide your refactoring decisions
- Ask the **AI** for context before diving into unfamiliar files

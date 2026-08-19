# Git checkpoint protocol

Load this reference only when the Project Folder is inside a Git work tree.

If the Project Folder is not inside a Git work tree, tell the user before making
presentation changes that persisted states from the development cycle cannot be
revisited through Git, then continue without commits.

Before invoking a Phase Skill, snapshot the Project Folder Git status. After the
phase completes, inspect the status again. If the phase changed presentation
files, stage only files changed by that phase and create one commit naming the
completed phase. A phase with no changes creates no commit.

Never stage pre-existing, unrelated, or secret-bearing changes. If Git cannot
create a checkpoint, report the exact failure and pause before advancing unless
the user explicitly chooses to continue without persisted checkpoints.

When a Restart Guard sends the project back to an earlier phase, commit the
confirmed reset before re-invoking that phase. Make the reset evident in the
commit message. In a non-Git Project Folder, report the persistence limitation
whenever a restart is confirmed.

# Form Designer direction

Patch should move toward the productive desktop application workflow associated with Delphi and Visual Basic without introducing a hidden form resource as a second source of truth.

Planned progression:

1. source-backed window/control geometry (`size`, `at`, control dimensions);
2. drag positioning and resize handles in Patch Studio that rewrite `main.patch`;
3. richer controls and events, beginning with checkbox/Boolean changed events;
4. multiple-form project navigation and form properties;
5. menus, dialogs, tabs, lists/tables and simple data binding;
6. native widget lowering after the form model stabilizes.

The design rule remains: visual edits must be readable Patch source, and ordinary persistent application-state mutation must still flow through semantic `change`.

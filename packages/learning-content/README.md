# Shared learning content

`index.mjs` defines the first version of the subject-neutral lesson contract. Every activity receives a stable `responseId` derived from its lesson and activity IDs. The contract supports choice, short answer, sequence, and editing activities, with optional hints and rubrics.

`browser.mjs` provides a small accessible renderer for the shared activity shapes. Existing apps keep their current presentation while exemplars are reviewed; the next step is to route approved activities through this renderer.

The reviewable first exemplars live in `content/exemplars/`: English sentence structure and editing, History early cities and evidence, and Philosophy argument reconstruction and counterexamples.
